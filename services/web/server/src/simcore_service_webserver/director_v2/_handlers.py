import asyncio
import logging
from typing import Any

from aiohttp import web
from common_library.json_serialization import json_dumps
from models_library.api_schemas_directorv2.comp_tasks import ComputationGet
from models_library.api_schemas_webserver.computations import ComputationStart
from models_library.projects import ProjectID
from pydantic import BaseModel, Field, TypeAdapter, ValidationError
from servicelib.aiohttp import status
from servicelib.aiohttp.rest_responses import create_http_error, exception_to_response
from servicelib.aiohttp.web_exceptions_extension import get_http_error_class_or_none
from servicelib.common_headers import (
    UNDEFINED_DEFAULT_SIMCORE_USER_AGENT_VALUE,
    X_SIMCORE_USER_AGENT,
)
from servicelib.request_keys import RQT_USERID_KEY
from simcore_postgres_database.utils_groups_extra_properties import (
    GroupExtraPropertiesRepo,
)

from .._meta import API_VTAG as VTAG
from ..db.plugin import get_database_engine
from ..login.decorators import login_required
from ..models import RequestContext
from ..products import products_web
from ..security.decorators import permission_required
from ..users.exceptions import UserDefaultWalletNotFoundError
from ..utils_aiohttp import envelope_json_response
from ..wallets.errors import WalletNotEnoughCreditsError
from ._abc import CommitID, get_project_run_policy
from ._api_utils import get_wallet_info
from ._core_computations import ComputationsApi
from .exceptions import DirectorServiceError

_logger = logging.getLogger(__name__)


routes = web.RouteTableDef()


class _ComputationStarted(BaseModel):
    pipeline_id: ProjectID = Field(
        ..., description="ID for created pipeline (=project identifier)"
    )
    ref_ids: list[CommitID] = Field(
        default_factory=list, description="Checkpoints IDs for created pipeline"
    )


@routes.post(f"/{VTAG}/computations/{{project_id}}:start", name="start_computation")
@login_required
@permission_required("services.pipeline.*")
@permission_required("project.read")
async def start_computation(request: web.Request) -> web.Response:
    # pylint: disable=too-many-statements
    try:
        req_ctx = RequestContext.model_validate(request)
        computations = ComputationsApi(request.app)

        run_policy = get_project_run_policy(request.app)
        assert run_policy  # nosec

        project_id = ProjectID(request.match_info["project_id"])

        subgraph: set[str] = set()
        force_restart: bool = False  # NOTE: deprecate this entry

        if request.can_read_body:
            body = await request.json()
            assert (
                TypeAdapter(ComputationStart).validate_python(body) is not None
            )  # nosec

            subgraph = body.get("subgraph", [])
            force_restart = bool(body.get("force_restart", force_restart))

        simcore_user_agent = request.headers.get(
            X_SIMCORE_USER_AGENT, UNDEFINED_DEFAULT_SIMCORE_USER_AGENT_VALUE
        )

        async with get_database_engine(request.app).acquire() as conn:
            group_properties = (
                await GroupExtraPropertiesRepo.get_aggregated_properties_for_user(
                    conn, user_id=req_ctx.user_id, product_name=req_ctx.product_name
                )
            )

        # Get wallet information
        product = products_web.get_current_product(request)
        wallet_info = await get_wallet_info(
            request.app,
            product=product,
            user_id=req_ctx.user_id,
            project_id=project_id,
            product_name=req_ctx.product_name,
        )

        options = {
            "start_pipeline": True,
            "subgraph": list(subgraph),  # sets are not natively json serializable
            "force_restart": force_restart,
            "simcore_user_agent": simcore_user_agent,
            "use_on_demand_clusters": group_properties.use_on_demand_clusters,
            "wallet_info": wallet_info,
        }

        running_project_ids: list[ProjectID]
        project_vc_commits: list[CommitID]

        (
            running_project_ids,
            project_vc_commits,
        ) = await run_policy.get_or_create_runnable_projects(request, project_id)
        _logger.debug(
            "Project %s will start %d variants: %s",
            f"{project_id=}",
            len(running_project_ids),
            f"{running_project_ids=}",
        )

        assert running_project_ids  # nosec
        assert (  # nosec
            len(running_project_ids) == len(project_vc_commits)
            if project_vc_commits
            else True
        )

        _started_pipelines_ids: list[str] = await asyncio.gather(
            *[
                computations.start(
                    pid, req_ctx.user_id, req_ctx.product_name, **options
                )
                for pid in running_project_ids
            ]
        )

        assert set(_started_pipelines_ids) == set(
            map(str, running_project_ids)
        )  # nosec

        data: dict[str, Any] = {
            "pipeline_id": project_id,
        }
        # Optional
        if project_vc_commits:
            data["ref_ids"] = project_vc_commits

        assert (
            TypeAdapter(_ComputationStarted).validate_python(data) is not None
        )  # nosec

        return envelope_json_response(data, status_cls=web.HTTPCreated)

    except DirectorServiceError as exc:
        return exception_to_response(
            create_http_error(
                exc,
                reason=exc.reason,
                http_error_cls=get_http_error_class_or_none(exc.status)
                or web.HTTPServiceUnavailable,
            )
        )
    except UserDefaultWalletNotFoundError as exc:
        return exception_to_response(
            create_http_error(exc, http_error_cls=web.HTTPNotFound)
        )
    except WalletNotEnoughCreditsError as exc:
        return exception_to_response(
            create_http_error(exc, http_error_cls=web.HTTPPaymentRequired)
        )


@routes.post(f"/{VTAG}/computations/{{project_id}}:stop", name="stop_computation")
@login_required
@permission_required("services.pipeline.*")
@permission_required("project.read")
async def stop_computation(request: web.Request) -> web.Response:
    req_ctx = RequestContext.model_validate(request)
    computations = ComputationsApi(request.app)
    run_policy = get_project_run_policy(request.app)
    assert run_policy  # nosec

    project_id = ProjectID(request.match_info["project_id"])

    try:
        project_ids: list[ProjectID] = await run_policy.get_runnable_projects_ids(
            request, project_id
        )
        _logger.debug("Project %s will stop %d variants", project_id, len(project_ids))

        await asyncio.gather(
            *[computations.stop(pid, req_ctx.user_id) for pid in project_ids]
        )
        return web.json_response(status=status.HTTP_204_NO_CONTENT)

    except DirectorServiceError as exc:
        return create_http_error(
            exc,
            reason=exc.reason,
            http_error_cls=get_http_error_class_or_none(exc.status)
            or web.HTTPServiceUnavailable,
        )


@routes.get(f"/{VTAG}/computations/{{project_id}}", name="get_computation")
@login_required
@permission_required("services.pipeline.*")
@permission_required("project.read")
async def get_computation(request: web.Request) -> web.Response:
    computations = ComputationsApi(request.app)
    run_policy = get_project_run_policy(request.app)
    assert run_policy  # nosec

    user_id = request[RQT_USERID_KEY]
    project_id = ProjectID(request.match_info["project_id"])

    try:
        project_ids: list[ProjectID] = await run_policy.get_runnable_projects_ids(
            request, project_id
        )
        _logger.debug("Project %s will get %d variants", project_id, len(project_ids))
        list_computation_tasks = TypeAdapter(list[ComputationGet]).validate_python(
            await asyncio.gather(
                *[
                    computations.get(project_id=pid, user_id=user_id)
                    for pid in project_ids
                ]
            ),
        )
        assert len(list_computation_tasks) == len(project_ids)  # nosec

        return web.json_response(
            data={"data": list_computation_tasks[0].model_dump(by_alias=True)},
            dumps=json_dumps,
        )
    except DirectorServiceError as exc:
        return create_http_error(
            exc,
            reason=exc.reason,
            http_error_cls=get_http_error_class_or_none(exc.status)
            or web.HTTPServiceUnavailable,
        )
    except ValidationError as exc:
        return create_http_error(exc, http_error_cls=web.HTTPInternalServerError)
