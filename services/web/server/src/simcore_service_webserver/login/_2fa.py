""" two-factor-authentication utils

Currently includes two parts:

- generation and storage of secret codes for 2FA validation (using redis)
- sending SMS of generated codes for validation (using twilio service)

"""

import asyncio
import logging
from typing import Optional, cast

from aiohttp import web
from pydantic import BaseModel, Field
from servicelib.logging_utils import log_decorator
from servicelib.utils_secrets import generate_passcode
from settings_library.twilio import TwilioSettings
from simcore_postgres_database.models.users import FullNameTuple, UserNameConverter
from twilio.rest import Client

from ..redis import get_redis_validation_code_client
from .utils_email import get_template_path, send_email_from_template

log = logging.getLogger(__name__)


def _get_human_readable_first_name(user_name: str) -> str:
    full_name: FullNameTuple = UserNameConverter.get_full_name(user_name)
    first_name = full_name.first_name.strip()[:20]  # security strip
    return cast(str, first_name.capitalize())


class ValidationCode(BaseModel):
    value: str = Field(..., description="The code")


#
# REDIS:
#  is used for generation and storage of secret codes
#
# SEE https://redis-py.readthedocs.io/en/stable/index.html


@log_decorator(log, level=logging.DEBUG)
async def _do_create_2fa_code(
    redis_client,
    user_email: str,
    *,
    expiration_seconds: int,
) -> str:
    hash_key, code = user_email, generate_passcode()
    await redis_client.set(hash_key, value=code, ex=expiration_seconds)
    return cast(str, code)


async def create_2fa_code(
    app: web.Application, *, user_email: str, expiration_in_seconds: int
) -> str:
    """Saves 2FA code with an expiration time, i.e. a finite Time-To-Live (TTL)"""
    redis_client = get_redis_validation_code_client(app)
    code = await _do_create_2fa_code(
        redis_client=redis_client,
        user_email=user_email,
        expiration_seconds=expiration_in_seconds,
    )
    return cast(str, code)


@log_decorator(log, level=logging.DEBUG)
async def get_2fa_code(app: web.Application, user_email: str) -> str | None:
    """Returns 2FA code for user or None if it does not exist (e.g. expired or never set)"""
    redis_client = get_redis_validation_code_client(app)
    hash_key = user_email
    hash_value = await redis_client.get(hash_key)
    return cast(Optional[str], hash_value)


@log_decorator(log, level=logging.DEBUG)
async def delete_2fa_code(app: web.Application, user_email: str) -> None:
    redis_client = get_redis_validation_code_client(app)
    hash_key = user_email
    await redis_client.delete(hash_key)


#
# TWILIO
#   - sms service
#


class SMSError(RuntimeError):
    pass


@log_decorator(log, level=logging.DEBUG)
async def send_sms_code(
    phone_number: str,
    code: str,
    twilo_auth: TwilioSettings,
    twilio_messaging_sid: str,
    twilio_alpha_numeric_sender: str,
    user_name: str = "user",
):
    first_name = _get_human_readable_first_name(user_name)
    create_kwargs = {
        "messaging_service_sid": twilio_messaging_sid,
        "to": phone_number,
        "body": f"Dear {first_name}, your verification code is {code}",
    }
    if twilo_auth.is_alphanumeric_supported(phone_number):
        create_kwargs["from_"] = twilio_alpha_numeric_sender

    def _sender():
        log.info(
            "Sending sms code to %s from product %s",
            f"{phone_number=}",
            twilio_alpha_numeric_sender,
        )
        #
        # SEE https://www.twilio.com/docs/sms/quickstart/python
        #
        client = Client(twilo_auth.TWILIO_ACCOUNT_SID, twilo_auth.TWILIO_AUTH_TOKEN)
        message = client.messages.create(**create_kwargs)

        log.debug(
            "Got twilio client %s",
            f"{message=}",
        )

    await asyncio.get_event_loop().run_in_executor(executor=None, func=_sender)


#
# EMAIL
#


class EmailError(RuntimeError):
    pass


@log_decorator(log, level=logging.DEBUG)
async def send_email_code(
    request: web.Request,
    user_email: str,
    support_email: str,
    code: str,
    user_name: str = "user",
):
    email_template_path = await get_template_path(request, "new_2fa_code.jinja2")
    first_name = _get_human_readable_first_name(user_name)
    await send_email_from_template(
        request,
        from_=support_email,
        to=user_email,
        template=email_template_path,
        context={
            "host": request.host,
            "code": code,
            "name": first_name,
            "support_email": support_email,
        },
    )


#
# HELPERS
#

_FROM, _TO = 3, -1


def mask_phone_number(phn: str) -> str:
    assert len(phn) > 5  # nosec
    # SEE https://github.com/pydantic/pydantic/issues/1551
    # SEE https://en.wikipedia.org/wiki/E.164
    return phn[:_FROM] + len(phn[_FROM:_TO]) * "X" + phn[_TO:]
