"""Core functionality and tools for user's registration

- registration code
- invitation code
"""

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime

from aiohttp import web
from common_library.error_codes import create_error_code
from models_library.basic_types import IdInt
from models_library.emails import LowerCaseEmailStr
from models_library.products import ProductName
from pydantic import (
    BaseModel,
    Field,
    Json,
    PositiveInt,
    TypeAdapter,
    ValidationError,
    field_validator,
)
from servicelib.logging_errors import create_troubleshootting_log_kwargs
from servicelib.mimetype_constants import MIMETYPE_APPLICATION_JSON
from simcore_postgres_database.models.confirmations import ConfirmationAction
from simcore_postgres_database.models.users import UserStatus
from yarl import URL

from ..groups.api import is_user_by_email_in_group
from ..invitations.api import (
    extract_invitation,
    is_service_invitation_code,
    validate_invitation_url,
)
from ..invitations.errors import (
    InvalidInvitationError,
    InvitationsServiceUnavailableError,
)
from ..products.models import Product
from ..users import users_service
from . import _auth_service, _confirmation_service
from ._login_repository_legacy import (
    AsyncpgStorage,
    BaseConfirmationTokenDict,
    ConfirmationTokenDict,
)
from .constants import (
    MSG_EMAIL_ALREADY_REGISTERED,
    MSG_INVITATIONS_CONTACT_SUFFIX,
    MSG_USER_DISABLED,
)
from .settings import LoginOptions

_logger = logging.getLogger(__name__)


class ConfirmationTokenInfoDict(ConfirmationTokenDict):
    expires: datetime
    url: str


class ConfirmedInvitationData(BaseModel):
    issuer: str | None = Field(
        None,
        description="Who has issued this invitation? (e.g. an email or a uid)",
    )
    guest: str | None = Field(
        None, description="Reference tag for this invitation", deprecated=True
    )
    trial_account_days: PositiveInt | None = Field(
        None,
        description="If set, this invitation will activate a trial account."
        "Sets the number of days from creation until the account expires",
    )
    extra_credits_in_usd: PositiveInt | None = None
    product: ProductName | None = None


class _InvitationValidator(BaseModel):
    action: ConfirmationAction
    data: Json[ConfirmedInvitationData]  # pylint: disable=unsubscriptable-object

    @field_validator("action", mode="before")
    @classmethod
    def ensure_enum(cls, v):
        if isinstance(v, ConfirmationAction):
            return v
        return ConfirmationAction(v)


ACTION_TO_DATA_TYPE: dict[ConfirmationAction, type | None] = {
    ConfirmationAction.INVITATION: ConfirmedInvitationData,
    ConfirmationAction.REGISTRATION: None,
}


async def _raise_if_registered_in_product(app: web.Application, user_email, product):
    # NOTE on `product.group_id is None`: A user can be registered in one of more products only if product groups are defined
    if product.group_id is None or await is_user_by_email_in_group(
        app, user_email=user_email, group_id=product.group_id
    ):
        raise web.HTTPConflict(
            text=MSG_EMAIL_ALREADY_REGISTERED,
            content_type=MIMETYPE_APPLICATION_JSON,
        )


async def check_other_registrations(
    app: web.Application,
    email: str,
    current_product: Product,
    db: AsyncpgStorage,
    cfg: LoginOptions,
) -> None:

    # An account is already registered with this email
    if user := await _auth_service.get_user_or_none(app, email=email):
        user_status = UserStatus(user["status"])
        match user_status:

            case UserStatus.ACTIVE:
                await _raise_if_registered_in_product(
                    app, user_email=user["email"], product=current_product
                )

            case UserStatus.CONFIRMATION_PENDING:
                # An account already registered with this email
                #
                #  RULE 'drop_previous_registration': any unconfirmed account w/o confirmation or
                #  w/ an expired confirmation will get deleted and its account (i.e. email)
                #  can be overtaken by this new registration
                #
                _confirmation = await db.get_confirmation(
                    filter_dict={
                        "user": user,
                        "action": ConfirmationAction.REGISTRATION.value,
                    }
                )
                drop_previous_registration = (
                    not _confirmation
                    or _confirmation_service.is_confirmation_expired(cfg, _confirmation)
                )
                if drop_previous_registration:
                    if not _confirmation:
                        await users_service.delete_user_without_projects(
                            app, user_id=user["id"], clean_cache=False
                        )
                    else:
                        await db.delete_confirmation_and_user(
                            user_id=user["id"], confirmation=_confirmation
                        )

                    _logger.warning(
                        "Re-registration of %s with expired %s"
                        "Deleting user and proceeding to a new registration",
                        f"{user=}",
                        f"{_confirmation=}",
                    )

            case _:  # Account was disabled
                assert user_status in (  # nosec
                    UserStatus.EXPIRED,
                    UserStatus.BANNED,
                    UserStatus.DELETED,
                )
                raise web.HTTPConflict(
                    text=MSG_USER_DISABLED.format(
                        support_email=current_product.support_email
                    ),
                    content_type=MIMETYPE_APPLICATION_JSON,
                )


async def create_invitation_token(
    db: AsyncpgStorage,
    *,
    user_id: IdInt,
    user_email: LowerCaseEmailStr | None = None,
    tag: str | None = None,
    trial_days: PositiveInt | None = None,
    extra_credits_in_usd: PositiveInt | None = None,
) -> ConfirmationTokenDict:
    """Creates an invitation token for a guest to register in the platform and returns

        Creates and injects an invitation token in the confirmation table associated
        to the host user

    :param host: valid user that creates the invitation
    :type host: Dict-like
    :param guest: some description of the guest, e.g. email, name or a json
    """
    data_model = ConfirmedInvitationData(
        issuer=user_email,
        guest=tag,
        trial_account_days=trial_days,
        extra_credits_in_usd=extra_credits_in_usd,
    )
    return await db.create_confirmation(
        user_id=user_id,
        action=ConfirmationAction.INVITATION.name,
        data=data_model.model_dump_json(),
    )


@contextmanager
def _invitations_request_context(invitation_code: str) -> Iterator[URL]:
    """
    - composes url from code
    - handles invitations errors as HTTPForbidden, HTTPServiceUnavailable
    """
    try:
        url = get_invitation_url(
            confirmation=BaseConfirmationTokenDict(
                code=invitation_code, action=ConfirmationAction.INVITATION.name
            ),
            origin=URL("https://dummyhost.com:8000"),
        )

        yield url

    except (ValidationError, InvalidInvitationError) as err:
        error_code = create_error_code(err)
        user_error_msg = f"Invalid invitation. {MSG_INVITATIONS_CONTACT_SUFFIX}"

        _logger.exception(
            **create_troubleshootting_log_kwargs(
                user_error_msg,
                error=err,
                error_code=error_code,
                tip="Something went wrong with the invitation",
            )
        )
        raise web.HTTPForbidden(
            text=user_error_msg,
            content_type=MIMETYPE_APPLICATION_JSON,
        ) from err

    except InvitationsServiceUnavailableError as err:
        error_code = create_error_code(err)
        user_error_msg = "Unable to process your invitation since the invitations service is currently unavailable"

        _logger.exception(
            **create_troubleshootting_log_kwargs(
                user_error_msg,
                error=err,
                error_code=error_code,
                tip="Something went wrong communicating the `invitations` service",
            )
        )
        raise web.HTTPServiceUnavailable(
            text=user_error_msg,
            content_type=MIMETYPE_APPLICATION_JSON,
        ) from err


async def extract_email_from_invitation(
    app: web.Application,
    invitation_code: str,
) -> LowerCaseEmailStr:
    """Returns associated email"""
    with _invitations_request_context(invitation_code=invitation_code) as url:
        content = await extract_invitation(app, invitation_url=f"{url}")
        return TypeAdapter(LowerCaseEmailStr).validate_python(content.guest)


async def check_and_consume_invitation(
    invitation_code: str,
    guest_email: str,
    product: Product,
    db: AsyncpgStorage,
    cfg: LoginOptions,
    app: web.Application,
) -> ConfirmedInvitationData:
    """Consumes invitation: the code is validated, the invitation retrieives and then deleted
       since it only has one use

    If valid, it returns InvitationData, otherwise it raises web.HTTPForbidden

    :raises web.HTTPForbidden
    """

    # service-type invitations
    if is_service_invitation_code(code=invitation_code):
        with _invitations_request_context(invitation_code=invitation_code) as url:
            content = await validate_invitation_url(
                app,
                current_product=product,
                guest_email=guest_email,
                invitation_url=f"{url}",
            )

            _logger.info(
                "Consuming invitation from service:\n%s",
                content.model_dump_json(indent=1),
            )
            return ConfirmedInvitationData(
                issuer=content.issuer,
                guest=content.guest,
                trial_account_days=content.trial_account_days,
                extra_credits_in_usd=content.extra_credits_in_usd,
                product=content.product,
            )

    # database-type invitations
    if confirmation_token := await _confirmation_service.validate_confirmation_code(
        invitation_code, db, cfg
    ):
        try:
            invitation_data: ConfirmedInvitationData = (
                _InvitationValidator.model_validate(confirmation_token).data
            )
            return invitation_data

        except ValidationError as err:
            _logger.warning(
                "%s is associated with an invalid %s.\nDetails: %s",
                f"{invitation_code=}",
                f"{confirmation_token=}",
                f"{err=}",
            )

        finally:
            await db.delete_confirmation(confirmation_token)
            _logger.info("Invitation with %s was consumed", f"{confirmation_token=}")

    raise web.HTTPForbidden(
        text=(
            "Invalid invitation code."
            "Your invitation was already used or might have expired."
            + MSG_INVITATIONS_CONTACT_SUFFIX
        ),
        content_type=MIMETYPE_APPLICATION_JSON,
    )


def get_invitation_url(
    confirmation: BaseConfirmationTokenDict, origin: URL | None = None
) -> URL:
    """Creates a URL to invite a user for registration

    This URL is sent to the user via email

    The user clicks URL link and ends up in the front-end

    This URL appends a fragment for front-end that interprets as open registration page
    and append the invitation code in the API request body together with the data added by the user
    """
    code = confirmation["code"]
    is_invitation = confirmation["action"] == ConfirmationAction.INVITATION.name

    if origin is None or not is_invitation:
        origin = URL()

    # https://some-web-url.io/#/registration/?invitation={code}
    # NOTE: Uniform encoding in front-end fragments https://github.com/ITISFoundation/osparc-simcore/issues/1975
    return origin.with_fragment(f"/registration/?invitation={code}")
