"""Users management

Keeps functionality that couples with the following app modules
   - users,
   - login
   - security
   - resource_manager

"""

import logging
import secrets
import string
from contextlib import suppress
from datetime import datetime
from typing import Final

import redis.asyncio as aioredis
from aiohttp import web
from common_library.users_enums import UserRole, UserStatus
from models_library.emails import LowerCaseEmailStr
from models_library.users import UserID
from pydantic import BaseModel, TypeAdapter
from redis.exceptions import LockNotOwnedError
from servicelib.aiohttp.application_keys import APP_FIRE_AND_FORGET_TASKS_KEY
from servicelib.logging_utils import log_decorator
from servicelib.utils import fire_and_forget_task
from servicelib.utils_secrets import generate_password
from simcore_postgres_database.utils_users import UsersRepo

from ..db.plugin import get_asyncpg_engine
from ..garbage_collector.settings import GUEST_USER_RC_LOCK_FORMAT
from ..groups import api as groups_service
from ..login._login_service import GUEST
from ..products import products_web
from ..redis import get_redis_lock_manager_client
from ..security import security_service, security_web
from ..users import users_service
from ..users.exceptions import UserNotFoundError
from ._constants import MSG_GUESTS_NOT_ALLOWED
from ._errors import GuestUsersLimitError
from .settings import StudiesDispatcherSettings, get_plugin_settings

_logger = logging.getLogger(__name__)


class UserInfo(BaseModel):
    id: int
    name: str
    email: LowerCaseEmailStr
    primary_gid: int
    needs_login: bool = False
    is_guest: bool = True


async def get_authorized_user(request: web.Request) -> dict:
    """Returns valid user if it is identified (cookie)
    and logged in (valid cookie)?
    """
    with suppress(web.HTTPUnauthorized, UserNotFoundError):
        user_id = await security_web.check_user_authorized(request)
        user: dict = await users_service.get_user(request.app, user_id)
        return user
    return {}


# GUEST_USER_RC_LOCK:
#
#   These locks prevents the GC from deleting a GUEST user in to stages of its lifefime:
#
#  1. During construction:
#     - Prevents GC from deleting this GUEST user while it is being created
#     - Since the user still does not have an ID assigned, the lock is named with his random_user_name
#     - the timeout here is the TTL of the lock in Redis. in case the webserver is overwhelmed and cannot create
#       a user during that time or crashes, then redis will ensure the lock disappears and let the garbage collector do its work
#
MAX_DELAY_TO_CREATE_USER: Final[int] = 8  # secs
#
#  2. During initialization
#     - Prevents the GC from deleting this GUEST user, with ID assigned, while it gets initialized and acquires it's first resource
#     - Uses the ID assigned to name the lock
#
MAX_DELAY_TO_GUEST_FIRST_CONNECTION: Final[int] = 15  # secs
#
#
# NOTES:
#   - In case of failure or excessive delay the lock has a timeout that automatically unlocks it
#     and the GC can clean up what remains
#   - Notice that the ids to name the locks are unique, therefore the lock can be acquired w/o errors
#   - These locks are very specific to resources and have timeout so the risk of blocking from GC is small
#


async def create_temporary_guest_user(request: web.Request):
    """Creates a guest user with a random name and

    Raises:
        MaxGuestUsersError: No more guest users allowed

    """
    redis_locks_client: aioredis.Redis = get_redis_lock_manager_client(request.app)
    settings: StudiesDispatcherSettings = get_plugin_settings(app=request.app)
    product_name = products_web.get_product_name(request)

    random_user_name = "".join(
        secrets.choice(string.ascii_lowercase) for _ in range(10)
    )
    email = TypeAdapter(LowerCaseEmailStr).validate_python(
        f"{random_user_name}@guest-at-osparc.io"
    )
    password = generate_password(length=12)
    expires_at = datetime.utcnow() + settings.STUDIES_GUEST_ACCOUNT_LIFETIME

    user_id: UserID | None = None

    repo = UsersRepo(get_asyncpg_engine(request.app))

    try:
        async with redis_locks_client.lock(
            GUEST_USER_RC_LOCK_FORMAT.format(user_id=random_user_name),
            timeout=MAX_DELAY_TO_CREATE_USER,
        ):
            # NOTE: usr Dict is incomplete, e.g. does not contain primary_gid
            user_row = await repo.new_user(
                email=email,
                password_hash=security_service.encrypt_password(password),
                status=UserStatus.ACTIVE,
                role=UserRole.GUEST,
                expires_at=expires_at,
            )
            user_id = user_row.id

            user = await users_service.get_user(request.app, user_id)
            await groups_service.auto_add_user_to_product_group(
                request.app, user_id=user_id, product_name=product_name
            )

            # (2) read details above
            await redis_locks_client.lock(
                GUEST_USER_RC_LOCK_FORMAT.format(user_id=user_id),
                timeout=MAX_DELAY_TO_GUEST_FIRST_CONNECTION,
            ).acquire()

    except LockNotOwnedError as err:
        # NOTE: The policy on number of GUETS users allowed is bound to the
        # load of the system.
        # If the lock times-out it is because a user cannot
        # be create in less that MAX_DELAY_TO_CREATE_USER seconds.
        # That shows that the system is really loaded and we rather
        # stop creating GUEST users.

        # NOTE: here we cleanup but if any trace is left it will be deleted by gc
        if user_id:

            async def _cleanup():
                with suppress(Exception):
                    await users_service.delete_user_without_projects(
                        request.app, user_id=user_id, clean_cache=False
                    )

            fire_and_forget_task(
                _cleanup(),
                task_suffix_name="cleanup_temporary_guest_user",
                fire_and_forget_tasks_collection=request.app[
                    APP_FIRE_AND_FORGET_TASKS_KEY
                ],
            )
        raise GuestUsersLimitError from err

    return user


@log_decorator(_logger, level=logging.DEBUG)
async def get_or_create_guest_user(
    request: web.Request, *, allow_anonymous_or_guest_users: bool
) -> UserInfo:
    """
    A user w/o authentication is denoted ANONYMOUS. If allow_anonymous_or_guest_users=True, then
    these users can be automatically promoted to GUEST. For that, a temporary guest account
    is created and associated to this user.

    GUEST users are therefore a special user that is un-identified to us (no email/name, etc)

    NOTE that if allow_anonymous_or_guest_users=False, GUEST users are NOT allowed in the system either.

    Arguments:
        allow_anonymous_or_guest_users -- if True, it will create a temporary GUEST account

    Raises:
        web.HTTPUnauthorized if ANONYMOUS users are not allowed (either w/o auth or as GUEST)

    """
    user = None

    # anonymous = no identity in request
    is_anonymous_user = await security_web.is_anonymous(request)
    if not is_anonymous_user:
        # NOTE: covers valid cookie with unauthorized user (e.g. expired guest/banned)
        user = await get_authorized_user(request)

    if not user and allow_anonymous_or_guest_users:
        _logger.debug("Anonymous user is accepted as guest...")
        user = await create_temporary_guest_user(request)
        is_anonymous_user = True

    if not allow_anonymous_or_guest_users and (not user or user.get("role") == GUEST):
        # NOTE: if allow_anonymous_users=False then GUEST users are NOT allowed!
        raise web.HTTPUnauthorized(text=MSG_GUESTS_NOT_ALLOWED)

    assert isinstance(user, dict)  # nosec

    return UserInfo(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        primary_gid=user["primary_gid"],
        needs_login=is_anonymous_user,
        is_guest=user.get("role") == GUEST,
    )


async def ensure_authentication(
    user: UserInfo, request: web.Request, response: web.Response
):
    if user.needs_login:
        _logger.debug("Auto login for anonymous user %s", user.name)
        await security_web.remember_identity(
            request,
            response,
            user_email=user.email,
        )
