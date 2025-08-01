import logging

from aiohttp import web
from aiohttp.web import RouteTableDef
from common_library.user_messages import user_message
from models_library.authentification import TwoFactorAuthentificationMethod
from pydantic import TypeAdapter
from servicelib.aiohttp import status
from servicelib.aiohttp.requests_validation import parse_request_body_as
from servicelib.logging_utils import get_log_record_extra, log_context
from servicelib.request_keys import RQT_USERID_KEY
from simcore_postgres_database.models.users import UserRole

from ...._meta import API_VTAG
from ....products import products_web
from ....products.models import Product
from ....security import security_web
from ....session.access_policies import (
    on_success_grant_session_access_to,
    session_access_required,
)
from ....user_preferences import user_preferences_service
from ....web_utils import envelope_response, flash_response
from ... import _auth_service, _login_service, _security_service, _twofa_service
from ...constants import (
    CODE_2FA_EMAIL_CODE_REQUIRED,
    CODE_2FA_SMS_CODE_REQUIRED,
    CODE_PHONE_NUMBER_REQUIRED,
    MAX_2FA_CODE_RESEND,
    MAX_2FA_CODE_TRIALS,
    MSG_2FA_CODE_SENT,
    MSG_EMAIL_SENT,
    MSG_LOGGED_OUT,
    MSG_PHONE_MISSING,
    MSG_UNAUTHORIZED_LOGIN_2FA,
    MSG_WRONG_2FA_CODE__EXPIRED,
    MSG_WRONG_2FA_CODE__INVALID,
)
from ...decorators import login_required
from ...settings import LoginSettingsForProduct, get_plugin_settings
from ._rest_exceptions import handle_rest_requests_exceptions
from .auth_schemas import LoginBody, LoginTwoFactorAuthBody, LogoutBody

log = logging.getLogger(__name__)


routes = RouteTableDef()


@routes.post(f"/{API_VTAG}/auth/login", name="auth_login")
@on_success_grant_session_access_to(
    name="auth_register_phone",
    max_access_count=MAX_2FA_CODE_TRIALS,
)
@on_success_grant_session_access_to(
    name="auth_login_2fa",
    max_access_count=MAX_2FA_CODE_TRIALS,
)
@on_success_grant_session_access_to(
    name="auth_resend_2fa_code",
    max_access_count=MAX_2FA_CODE_RESEND,
)
@handle_rest_requests_exceptions
async def login(request: web.Request):
    """Login: user submits an email (identification) and a password

    If 2FA is enabled, then the login continues with a second request to login_2fa
    """
    product: Product = products_web.get_current_product(request)
    settings: LoginSettingsForProduct = get_plugin_settings(
        request.app, product_name=product.name
    )
    login_data = await parse_request_body_as(LoginBody, request)

    # Authenticate user and verify access to the product
    user = await _auth_service.get_user_or_none(request.app, email=login_data.email)

    user = _auth_service.check_not_null_user(user)

    user = await _auth_service.check_authorized_user_credentials(
        request.app,
        user,
        password=login_data.password.get_secret_value(),
        product=product,
    )
    await _auth_service.check_authorized_user_in_product(
        request.app, user_email=user["email"], product=product
    )

    # Check if user role allows skipping 2FA or if 2FA is not required
    skip_2fa = UserRole(user["role"]) == UserRole.TESTER
    if skip_2fa or not settings.LOGIN_2FA_REQUIRED:
        return await _security_service.login_granted_response(request, user=user)

    # 2FA login process continuation
    user_2fa_preference = await user_preferences_service.get_frontend_user_preference(
        request.app,
        user_id=user["id"],
        product_name=product.name,
        preference_class=user_preferences_service.TwoFAFrontendUserPreference,
    )
    if not user_2fa_preference:
        user_2fa_authentification_method = TwoFactorAuthentificationMethod.SMS
        preference_id = (
            user_preferences_service.TwoFAFrontendUserPreference().preference_identifier
        )
        await user_preferences_service.set_frontend_user_preference(
            request.app,
            user_id=user["id"],
            product_name=product.name,
            frontend_preference_identifier=preference_id,
            value=user_2fa_authentification_method,
        )
    else:
        user_2fa_authentification_method = TypeAdapter(
            TwoFactorAuthentificationMethod
        ).validate_python(user_2fa_preference.value)

    if user_2fa_authentification_method == TwoFactorAuthentificationMethod.DISABLED:
        return await _security_service.login_granted_response(request, user=user)

    # Check phone for SMS authentication
    if (
        user_2fa_authentification_method == TwoFactorAuthentificationMethod.SMS
        and not user["phone"]
    ):
        return envelope_response(
            # LoginNextPage
            {
                "name": CODE_PHONE_NUMBER_REQUIRED,
                "parameters": {
                    "message": MSG_PHONE_MISSING,
                    "next_url": f"{request.app.router['auth_register_phone'].url_for()}",
                },
            },
            status=status.HTTP_202_ACCEPTED,
        )

    code = await _twofa_service.create_2fa_code(
        app=request.app,
        user_email=user["email"],
        expiration_in_seconds=settings.LOGIN_2FA_CODE_EXPIRATION_SEC,
    )

    if user_2fa_authentification_method == TwoFactorAuthentificationMethod.SMS:
        # create sms 2FA
        assert user["phone"]  # nosec
        assert settings.LOGIN_2FA_REQUIRED  # nosec
        assert settings.LOGIN_TWILIO  # nosec
        assert product.twilio_messaging_sid  # nosec

        await _twofa_service.send_sms_code(
            phone_number=user["phone"],
            code=code,
            twilio_auth=settings.LOGIN_TWILIO,
            twilio_messaging_sid=product.twilio_messaging_sid,
            twilio_alpha_numeric_sender=product.twilio_alpha_numeric_sender_id,
            first_name=user["first_name"] or user["name"],
            user_id=user["id"],
        )

        return envelope_response(
            # LoginNextPage
            {
                "name": CODE_2FA_SMS_CODE_REQUIRED,
                "parameters": {
                    "message": MSG_2FA_CODE_SENT.format(
                        phone_number=_twofa_service.mask_phone_number(user["phone"])
                    ),
                    "expiration_2fa": settings.LOGIN_2FA_CODE_EXPIRATION_SEC,
                },
            },
            status=status.HTTP_202_ACCEPTED,
        )

    # otherwise create email f2a
    assert (
        user_2fa_authentification_method == TwoFactorAuthentificationMethod.EMAIL
    )  # nosec
    await _twofa_service.send_email_code(
        request,
        user_email=user["email"],
        support_email=product.support_email,
        code=code,
        first_name=user["first_name"] or user["name"],
        product=product,
        user_id=user["id"],
    )
    return envelope_response(
        {
            "name": CODE_2FA_EMAIL_CODE_REQUIRED,
            "parameters": {
                "message": MSG_EMAIL_SENT.format(email=user["email"]),
                "expiration_2fa": settings.LOGIN_2FA_CODE_EXPIRATION_SEC,
            },
        },
        status=status.HTTP_202_ACCEPTED,
    )


@routes.post(f"/{API_VTAG}/auth/validate-code-login", name="auth_login_2fa")
@session_access_required(
    "auth_login_2fa",
    unauthorized_reason=MSG_UNAUTHORIZED_LOGIN_2FA,
)
@handle_rest_requests_exceptions
async def login_2fa(request: web.Request):
    """Login (continuation): Submits 2FA code"""
    product: Product = products_web.get_current_product(request)
    settings: LoginSettingsForProduct = get_plugin_settings(
        request.app, product_name=product.name
    )
    if not settings.LOGIN_2FA_REQUIRED:
        raise web.HTTPServiceUnavailable(
            text=user_message("2FA login is not available"),
        )

    # validates input params
    login_2fa_ = await parse_request_body_as(LoginTwoFactorAuthBody, request)

    # validates code
    _expected_2fa_code = await _twofa_service.get_2fa_code(
        request.app, login_2fa_.email
    )
    if not _expected_2fa_code:
        raise web.HTTPUnauthorized(text=MSG_WRONG_2FA_CODE__EXPIRED)
    if login_2fa_.code.get_secret_value() != _expected_2fa_code:
        raise web.HTTPUnauthorized(text=MSG_WRONG_2FA_CODE__INVALID)

    user = _auth_service.check_not_null_user(
        await _auth_service.get_user_or_none(request.app, email=login_2fa_.email)
    )

    # NOTE: a priviledge user should not have called this entrypoint
    assert UserRole(user["role"]) <= UserRole.USER  # nosec

    # dispose since code was used
    await _twofa_service.delete_2fa_code(request.app, login_2fa_.email)

    return await _security_service.login_granted_response(request, user=user)


@routes.post(f"/{API_VTAG}/auth/logout", name="auth_logout")
@login_required
@handle_rest_requests_exceptions
async def logout(request: web.Request) -> web.Response:
    user_id = request.get(RQT_USERID_KEY, -1)

    logout_ = await parse_request_body_as(LogoutBody, request)

    # Keep log message: https://github.com/ITISFoundation/osparc-simcore/issues/3200
    with log_context(
        log,
        logging.INFO,
        "logout of %s for %s",
        f"{user_id=}",
        f"{logout_.client_session_id=}",
        extra=get_log_record_extra(user_id=user_id),
    ):
        response = flash_response(MSG_LOGGED_OUT, "INFO")
        await _login_service.notify_user_logout(
            request.app, user_id, logout_.client_session_id
        )
        await security_web.forget_identity(request, response)

        return response
