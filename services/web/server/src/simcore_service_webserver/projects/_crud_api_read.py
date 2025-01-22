""" Utils to implement READ operations (from cRud) on the project resource


Read operations are list, get

"""

from aiohttp import web
from models_library.api_schemas_webserver.projects import ProjectListItem
from models_library.folders import FolderID, FolderQuery, FolderScope
from models_library.projects import ProjectID
from models_library.rest_ordering import OrderBy
from models_library.users import UserID
from models_library.workspaces import WorkspaceID, WorkspaceQuery, WorkspaceScope
from pydantic import NonNegativeInt
from servicelib.utils import logged_gather
from simcore_postgres_database.models.projects import ProjectType
from simcore_postgres_database.webserver_models import ProjectType as ProjectTypeDB

from ..catalog.client import get_services_for_user_in_product
from ..folders import _folders_repository as folders_db
from ..workspaces._workspaces_service import check_user_workspace_access
from ._permalink_api import update_or_pop_permalink_in_project
from . import projects_service
from .db import ProjectDBAPI
from .models import ProjectDict, ProjectTypeAPI


async def _append_item(
    request: web.Request,
    *,
    user_id: UserID,
    project: ProjectDict,
    is_template: bool,
):
    # state
    await projects_service.add_project_states_for_user(
        user_id=user_id,
        project=project,
        is_template=is_template,
        app=request.app,
    )

    # permalink
    await update_or_pop_permalink_in_project(request, project)

    # validate
    return ProjectListItem.from_domain_model(project).data(exclude_unset=True)


async def list_projects(  # pylint: disable=too-many-arguments
    request: web.Request,
    user_id: UserID,
    product_name: str,
    *,
    # hierachy filter
    workspace_id: WorkspaceID | None,
    folder_id: FolderID | None,
    # attrs filter
    project_type: ProjectTypeAPI,
    show_hidden: bool,
    trashed: bool | None,
    # search
    multi_column_search: str | None = None,
    project_name_search: str | None = None,
    # pagination
    offset: NonNegativeInt,
    limit: int,
    # ordering
    order_by: OrderBy,
) -> tuple[list[ProjectDict], int]:
    app = request.app
    db = ProjectDBAPI.get_from_app_context(app)

    user_available_services: list[dict] = await get_services_for_user_in_product(
        app, user_id, product_name, only_key_versions=True
    )

    workspace_is_private = True
    if workspace_id:
        await check_user_workspace_access(
            app,
            user_id=user_id,
            workspace_id=workspace_id,
            product_name=product_name,
            permission="read",
        )
        workspace_is_private = False

    if folder_id:
        # Check whether user has access to the folder
        await folders_db.get_for_user_or_workspace(
            app,
            folder_id=folder_id,
            product_name=product_name,
            user_id=user_id if workspace_is_private else None,
            workspace_id=workspace_id,
        )

    db_projects, db_project_types, total_number_projects = await db.list_projects(
        product_name=product_name,
        user_id=user_id,
        workspace_query=(
            WorkspaceQuery(
                workspace_scope=WorkspaceScope.SHARED, workspace_id=workspace_id
            )
            if workspace_id
            else WorkspaceQuery(workspace_scope=WorkspaceScope.PRIVATE)
        ),
        folder_query=(
            FolderQuery(folder_scope=FolderScope.SPECIFIC, folder_id=folder_id)
            if folder_id
            else FolderQuery(folder_scope=FolderScope.ROOT)
        ),
        # attrs
        filter_by_project_type=ProjectTypeAPI.to_project_type_db(project_type),
        filter_by_services=user_available_services,
        filter_trashed=trashed,
        filter_hidden=show_hidden,
        # composed attrs
        multi_column_search=multi_column_search,
        project_name_search=project_name_search,
        # pagination
        offset=offset,
        limit=limit,
        # order
        order_by=order_by,
    )

    projects: list[ProjectDict] = await logged_gather(
        *(
            _append_item(
                request,
                user_id=user_id,
                project=prj,
                is_template=prj_type == ProjectTypeDB.TEMPLATE,
            )
            for prj, prj_type in zip(db_projects, db_project_types, strict=False)
        ),
        reraise=True,
        max_concurrency=100,
    )

    return projects, total_number_projects


async def list_projects_full_depth(
    request,
    *,
    user_id: UserID,
    product_name: str,
    # attrs filter
    trashed: bool | None,
    tag_ids_list: list[int],
    # pagination
    offset: NonNegativeInt,
    limit: int,
    order_by: OrderBy,
    # search
    multi_column_search: str | None,
    project_name_search: str | None,
) -> tuple[list[ProjectDict], int]:
    db = ProjectDBAPI.get_from_app_context(request.app)

    user_available_services: list[dict] = await get_services_for_user_in_product(
        request.app, user_id, product_name, only_key_versions=True
    )

    db_projects, db_project_types, total_number_projects = await db.list_projects(
        product_name=product_name,
        user_id=user_id,
        workspace_query=WorkspaceQuery(workspace_scope=WorkspaceScope.ALL),
        folder_query=FolderQuery(folder_scope=FolderScope.ALL),
        filter_trashed=trashed,
        filter_by_services=user_available_services,
        filter_tag_ids_list=tag_ids_list,
        filter_by_project_type=ProjectType.STANDARD,
        multi_column_search=multi_column_search,
        project_name_search=project_name_search,
        offset=offset,
        limit=limit,
        order_by=order_by,
    )

    projects: list[ProjectDict] = await logged_gather(
        *(
            _append_item(
                request,
                user_id=user_id,
                project=prj,
                is_template=prj_type == ProjectTypeDB.TEMPLATE,
            )
            for prj, prj_type in zip(db_projects, db_project_types, strict=False)
        ),
        reraise=True,
        max_concurrency=100,
    )

    return projects, total_number_projects


async def get_project(
    request: web.Request,
    user_id: UserID,
    product_name: str,
    project_uuid: ProjectID,
    project_type: ProjectTypeAPI,
):
    raise NotImplementedError
