"""Defines the different exceptions that may arise in the catalog subpackage"""

import logging

from aiohttp import web
from common_library.error_codes import create_error_code
from models_library.rest_error import ErrorGet
from servicelib.aiohttp import status
from servicelib.logging_errors import create_troubleshotting_log_kwargs
from servicelib.rabbitmq._errors import RemoteMethodNotRegisteredError
from servicelib.rabbitmq.rpc_interfaces.catalog.errors import (
    CatalogForbiddenError,
    CatalogItemNotFoundError,
)

from ..exception_handling import (
    ExceptionHandlersMap,
    ExceptionToHttpErrorMap,
    HttpErrorInfo,
    create_error_context_from_request,
    create_error_response,
    exception_handling_decorator,
    to_exceptions_handlers_map,
)
from ..resource_usage.errors import DefaultPricingPlanNotFoundError
from ._constants import MSG_CATALOG_SERVICE_NOT_FOUND, MSG_CATALOG_SERVICE_UNAVAILABLE
from .errors import (
    CatalogConnectionError,
    CatalogResponseError,
    DefaultPricingUnitForServiceNotFoundError,
)

# mypy: disable-error-code=truthy-function
assert CatalogForbiddenError  # nosec
assert CatalogItemNotFoundError  # nosec


_logger = logging.getLogger(__name__)


async def _handler_catalog_client_errors(
    request: web.Request, exception: Exception
) -> web.Response:

    assert isinstance(  # nosec
        exception, CatalogResponseError | CatalogConnectionError
    ), f"check mapping, got {exception=}"

    if (
        isinstance(exception, CatalogResponseError)
        and exception.status == status.HTTP_404_NOT_FOUND
    ):
        error = ErrorGet(
            status=status.HTTP_404_NOT_FOUND,
            message=MSG_CATALOG_SERVICE_NOT_FOUND,
        )

    else:
        # NOTE: The remaining errors are mapped to 503
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        user_msg = MSG_CATALOG_SERVICE_UNAVAILABLE

        # Log for further investigation
        oec = create_error_code(exception)
        _logger.exception(
            **create_troubleshotting_log_kwargs(
                user_msg,
                error=exception,
                error_code=oec,
                error_context={
                    **create_error_context_from_request(request),
                    "error_code": oec,
                },
            )
        )
        error = ErrorGet.model_construct(
            message=user_msg,
            support_id=oec,
            status=status_code,
        )

    return create_error_response(error, status_code=error.status)


_TO_HTTP_ERROR_MAP: ExceptionToHttpErrorMap = {
    RemoteMethodNotRegisteredError: HttpErrorInfo(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        MSG_CATALOG_SERVICE_UNAVAILABLE,
    ),
    CatalogForbiddenError: HttpErrorInfo(
        status.HTTP_403_FORBIDDEN,
        "Forbidden catalog access",
    ),
    CatalogItemNotFoundError: HttpErrorInfo(
        status.HTTP_404_NOT_FOUND,
        "Catalog item not found",
    ),
    DefaultPricingPlanNotFoundError: HttpErrorInfo(
        status.HTTP_404_NOT_FOUND,
        "Default pricing plan not found",
    ),
    DefaultPricingUnitForServiceNotFoundError: HttpErrorInfo(
        status.HTTP_404_NOT_FOUND, "Default pricing unit not found"
    ),
}


catalog_exceptions_handlers_map: ExceptionHandlersMap = {
    CatalogResponseError: _handler_catalog_client_errors,
    CatalogConnectionError: _handler_catalog_client_errors,
}
catalog_exceptions_handlers_map.update(to_exceptions_handlers_map(_TO_HTTP_ERROR_MAP))

handle_plugin_requests_exceptions = exception_handling_decorator(
    catalog_exceptions_handlers_map
)
