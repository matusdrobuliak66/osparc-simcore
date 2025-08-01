import logging
from typing import Any, Literal

from aiohttp import web
from models_library.api_schemas_webserver.projects_ports import (
    ProjectInputGet,
    ProjectInputUpdate,
    ProjectOutputGet,
)
from models_library.basic_types import KeyIDStr
from models_library.projects import ProjectID
from models_library.projects_nodes import Node
from models_library.projects_nodes_io import NodeID
from models_library.users import UserID
from models_library.utils.fastapi_encoders import jsonable_encoder
from models_library.utils.services_io import JsonSchemaDict
from pydantic import BaseModel, Field, TypeAdapter
from servicelib.aiohttp.requests_validation import (
    parse_request_body_as,
    parse_request_headers_as,
    parse_request_path_parameters_as,
)

from ..._meta import API_VTAG as VTAG
from ...login.decorators import login_required
from ...models import ClientSessionHeaderParams
from ...security.decorators import permission_required
from ...utils_aiohttp import envelope_json_response
from .. import _ports_service, _projects_service
from .._access_rights_service import check_user_project_permission
from .._projects_repository_legacy import ProjectDBAPI
from ..models import ProjectDict
from ._rest_exceptions import handle_plugin_requests_exceptions
from ._rest_schemas import AuthenticatedRequestContext, ProjectPathParams

log = logging.getLogger(__name__)


async def _get_validated_workbench_model(
    app: web.Application, project_id: ProjectID, user_id: UserID
) -> dict[NodeID, Node]:
    project: ProjectDict = await _projects_service.get_project_for_user(
        app,
        project_uuid=f"{project_id}",
        user_id=user_id,
        include_state=False,
    )

    return TypeAdapter(dict[NodeID, Node]).validate_python(project["workbench"])


routes = web.RouteTableDef()


# projects/*/inputs COLLECTION -------------------------
#


@routes.get(f"/{VTAG}/projects/{{project_id}}/inputs", name="get_project_inputs")
@login_required
@permission_required("project.read")
@handle_plugin_requests_exceptions
async def get_project_inputs(request: web.Request) -> web.Response:
    req_ctx = AuthenticatedRequestContext.model_validate(request)
    path_params = parse_request_path_parameters_as(ProjectPathParams, request)

    assert request.app  # nosec

    workbench = await _get_validated_workbench_model(
        app=request.app, project_id=path_params.project_id, user_id=req_ctx.user_id
    )
    inputs: dict[NodeID, Any] = _ports_service.get_project_inputs(workbench)

    return envelope_json_response(
        {
            node_id: ProjectInputGet(
                key=node_id, label=workbench[node_id].label, value=value
            )
            for node_id, value in inputs.items()
        }
    )


@routes.patch(f"/{VTAG}/projects/{{project_id}}/inputs", name="update_project_inputs")
@login_required
@permission_required("project.update")
@handle_plugin_requests_exceptions
async def update_project_inputs(request: web.Request) -> web.Response:
    db: ProjectDBAPI = ProjectDBAPI.get_from_app_context(request.app)
    req_ctx = AuthenticatedRequestContext.model_validate(request)
    path_params = parse_request_path_parameters_as(ProjectPathParams, request)
    inputs_updates = await parse_request_body_as(list[ProjectInputUpdate], request)
    header_params = parse_request_headers_as(ClientSessionHeaderParams, request)

    assert request.app  # nosec

    workbench = await _get_validated_workbench_model(
        app=request.app, project_id=path_params.project_id, user_id=req_ctx.user_id
    )
    current_inputs: dict[NodeID, Any] = _ports_service.get_project_inputs(workbench)

    # build workbench patch
    partial_workbench_data = {}
    for input_update in inputs_updates:
        node_id = input_update.key
        if node_id not in current_inputs:
            raise web.HTTPBadRequest(text=f"Invalid input key [{node_id}]")

        workbench[node_id].outputs = {KeyIDStr("out_1"): input_update.value}
        partial_workbench_data[node_id] = workbench[node_id].model_dump(
            include={"outputs"}, exclude_unset=True
        )

    # patch workbench
    await check_user_project_permission(
        request.app,
        project_id=path_params.project_id,
        user_id=req_ctx.user_id,
        product_name=req_ctx.product_name,
        permission="write",
    )

    assert db  # nosec
    updated_project, _ = await db.update_project_multiple_node_data(
        user_id=req_ctx.user_id,
        project_uuid=path_params.project_id,
        product_name=req_ctx.product_name,
        partial_workbench_data=jsonable_encoder(partial_workbench_data),
        client_session_id=header_params.client_session_id,
    )

    workbench = TypeAdapter(dict[NodeID, Node]).validate_python(
        updated_project["workbench"]
    )
    inputs: dict[NodeID, Any] = _ports_service.get_project_inputs(workbench)

    return envelope_json_response(
        {
            node_id: ProjectInputGet(
                key=node_id, label=workbench[node_id].label, value=value
            )
            for node_id, value in inputs.items()
        }
    )


#
# projects/*/outputs COLLECTION -------------------------
#


@routes.get(f"/{VTAG}/projects/{{project_id}}/outputs", name="get_project_outputs")
@login_required
@permission_required("project.read")
@handle_plugin_requests_exceptions
async def get_project_outputs(request: web.Request) -> web.Response:
    req_ctx = AuthenticatedRequestContext.model_validate(request)
    path_params = parse_request_path_parameters_as(ProjectPathParams, request)

    assert request.app  # nosec

    workbench = await _get_validated_workbench_model(
        app=request.app, project_id=path_params.project_id, user_id=req_ctx.user_id
    )
    outputs: dict[NodeID, Any] = await _ports_service.get_project_outputs(
        request.app, project_id=path_params.project_id, workbench=workbench
    )

    return envelope_json_response(
        {
            node_id: ProjectOutputGet(
                key=node_id, label=workbench[node_id].label, value=value
            )
            for node_id, value in outputs.items()
        }
    )


#
# projects/*/metadata/ports sub-collection -------------------------
#


class ProjectMetadataPortGet(BaseModel):
    key: NodeID = Field(
        ...,
        description="Project port's unique identifer. Same as the UUID of the associated port node",
    )
    kind: Literal["input", "output"]
    content_schema: JsonSchemaDict | None = Field(
        None,
        description="jsonschema for the port's value. SEE https://json-schema.org/understanding-json-schema/",
    )


@routes.get(
    f"/{VTAG}/projects/{{project_id}}/metadata/ports",
    name="list_project_metadata_ports",
)
@login_required
@permission_required("project.read")
@handle_plugin_requests_exceptions
async def list_project_metadata_ports(request: web.Request) -> web.Response:
    req_ctx = AuthenticatedRequestContext.model_validate(request)
    path_params = parse_request_path_parameters_as(ProjectPathParams, request)

    assert request.app  # nosec

    workbench = await _get_validated_workbench_model(
        app=request.app, project_id=path_params.project_id, user_id=req_ctx.user_id
    )

    return envelope_json_response(
        [
            ProjectMetadataPortGet(
                key=port.node_id,
                kind=port.kind,
                content_schema=port.get_schema(),
            )
            for port in _ports_service.iter_project_ports(workbench)
        ]
    )
