""" Parses and validation aiohttp requests against pydantic models

Rationale: These functions follow an interface analogous to ``pydantic.tools``'s

   parse_obj_as(model_class, obj)

but adapted to parse&validate path, query and body of an aiohttp's request
"""

import json.decoder
from contextlib import contextmanager
from typing import Iterator, TypeAlias, TypeVar, Union

from aiohttp import web
from pydantic import BaseModel, ValidationError, parse_obj_as

from ..json_serialization import json_dumps
from ..mimetype_constants import MIMETYPE_APPLICATION_JSON

ModelClass = TypeVar("ModelClass", bound=BaseModel)
ModelOrListType = TypeVar("ModelOrListType", bound=Union[BaseModel, list])
UnionOfModelTypes: TypeAlias = Union[type[ModelClass], type[ModelClass]]

@contextmanager
def handle_validation_as_http_error(
    *, error_msg_template: str, resource_name: str, use_error_v1: bool
) -> Iterator[None]:
    """Context manager to handle ValidationError and reraise them as HTTPUnprocessableEntity error

    Arguments:
        error_msg_template -- _description_
        resource_name --
        use_error_v1 -- If True, it uses new error response

    Raises:
        web.HTTPUnprocessableEntity: (422) raised from a ValidationError

    """

    try:

        yield

    except ValidationError as err:
        details = [
            {
                "loc": ".".join(map(str, e["loc"])),
                "msg": e["msg"],
                "type": e["type"],
            }
            for e in err.errors()
        ]
        reason_msg = error_msg_template.format(
            failed=", ".join(d["loc"] for d in details)
        )

        if use_error_v1:
            # NOTE: keeps backwards compatibility until ligher error response is implemented in the entire API
            # Implements servicelib.aiohttp.rest_responses.ErrorItemType
            errors = [
                {
                    "code": e["type"],
                    "message": e["msg"],
                    "resource": resource_name,
                    "field": e["loc"],
                }
                for e in details
            ]
            error_str = json_dumps(
                {
                    "error": {
                        "status": web.HTTPUnprocessableEntity.status_code,
                        "errors": errors,
                    }
                }
            )
        else:
            # NEW proposed error for https://github.com/ITISFoundation/osparc-simcore/issues/443
            error_str = json_dumps(
                {
                    "error": {
                        "msg": reason_msg,
                        "resource": resource_name,  # optional
                        "details": details,  # optional
                    }
                }
            )

        raise web.HTTPUnprocessableEntity(  # 422
            reason=reason_msg,
            text=error_str,
            content_type=MIMETYPE_APPLICATION_JSON,
        )


# NOTE:
#
# - parameters in the path are part of the resource name and therefore are required
# - parameters in the query are typically extra options like flags or filter options
# - body holds the request data
#


def parse_request_path_parameters_as(
    parameters_schema_cls: type[ModelClass],
    request: web.Request,
    *,
    use_enveloped_error_v1: bool = True,
) -> ModelClass:
    """Parses path parameters from 'request' and validates against 'parameters_schema'


    Keyword Arguments:
        use_enveloped_error_v1 -- new enveloped error model (default: {True})

    Raises:
        web.HTTPUnprocessableEntity: (422) if validation of parameters  fail

    Returns:
        Validated model of path parameters
    """

    with handle_validation_as_http_error(
        error_msg_template="Invalid parameter/s '{failed}' in request path",
        resource_name=request.rel_url.path,
        use_error_v1=use_enveloped_error_v1,
    ):
        data = dict(request.match_info)
        return parameters_schema_cls.parse_obj(data)


def parse_request_query_parameters_as(
    parameters_schema_cls: type[ModelClass] | UnionOfModelTypes,
    request: web.Request,
    *,
    use_enveloped_error_v1: bool = True,
) -> ModelClass:
    """Parses query parameters from 'request' and validates against 'parameters_schema'


    Keyword Arguments:
        use_enveloped_error_v1 -- new enveloped error model (default: {True})

    Raises:
        web.HTTPUnprocessableEntity: (422) if validation of parameters  fail

    Returns:
        Validated model of query parameters
    """

    with handle_validation_as_http_error(
        error_msg_template="Invalid parameter/s '{failed}' in request query",
        resource_name=request.rel_url.path,
        use_error_v1=use_enveloped_error_v1,
    ):
        data = dict(request.query)
        if hasattr(parameters_schema_cls, "parse_obj"):
            return parameters_schema_cls.parse_obj(data)
        return parse_obj_as(parameters_schema_cls, data)


async def parse_request_body_as(
    model_schema_cls: type[ModelOrListType],
    request: web.Request,
    *,
    use_enveloped_error_v1: bool = True,
) -> ModelOrListType:
    """Parses and validates request body against schema

    Keyword Arguments:
        use_enveloped_error_v1 -- new enveloped error model (default: {True})

    Raises:
        web.HTTPBadRequest: (400) if invalid json body
        web.HTTPUnprocessableEntity: (422) if does not validates against schema

    Returns:
        Validated model of request body
    """
    with handle_validation_as_http_error(
        error_msg_template="Invalid field/s '{failed}' in request body",
        resource_name=request.rel_url.path,
        use_error_v1=use_enveloped_error_v1,
    ):
        if not request.can_read_body:
            # requests w/o body e.g. when model-schema is fully optional
            body = {}
        else:
            try:
                body = await request.json()
            except json.decoder.JSONDecodeError as err:
                raise web.HTTPBadRequest(reason=f"Invalid json in body: {err}")

        if hasattr(model_schema_cls, "parse_obj"):
            # NOTE: model_schema can be 'list[T]' or 'dict[T]' which raise TypeError
            # with issubclass(model_schema, BaseModel)
            assert issubclass(model_schema_cls, BaseModel)  # nosec
            return model_schema_cls.parse_obj(body)

        # used for model_schema like 'list[T]' or 'dict[T]'
        return parse_obj_as(model_schema_cls, body)
