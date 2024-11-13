""" Handlers for CRUD operations on /projects/{*}/tags/{*}

"""

import logging

from aiohttp import web
from models_library.projects import ProjectID
from models_library.rabbitmq_messages import RabbitResourceTrackingProjectSyncMessage
from models_library.users import UserID
from models_library.workspaces import UserWorkspaceAccessRightsDB
from servicelib.aiohttp.db_asyncpg_engine import get_async_engine
from simcore_postgres_database.utils_tags import TagsRepo
from simcore_service_webserver.rabbitmq import get_rabbitmq_client
from sqlalchemy.ext.asyncio import AsyncEngine

from ..workspaces import _workspaces_db as workspaces_db
from ._access_rights_api import check_user_project_permission
from .db import ProjectDBAPI
from .models import ProjectDict

_logger = logging.getLogger(__name__)


async def add_tag(
    app: web.Application, user_id: UserID, project_uuid: ProjectID, tag_id: int
) -> ProjectDict:
    db: ProjectDBAPI = ProjectDBAPI.get_from_app_context(app)

    product_name = await db.get_project_product(project_uuid)
    await check_user_project_permission(
        app,
        project_id=project_uuid,
        user_id=user_id,
        product_name=product_name,
        permission="write",
    )

    project: ProjectDict = await db.add_tag(
        project_uuid=f"{project_uuid}", user_id=user_id, tag_id=int(tag_id)
    )

    # Inform RUT about tag change
    engine: AsyncEngine = get_async_engine(app)
    tags_repo = TagsRepo(engine)
    project_tags = await tags_repo.list_tag_ids_and_names_by_project_uuid(
        project_uuid=project_uuid
    )

    rabbit_client = get_rabbitmq_client(app)
    await rabbit_client.publish(
        RabbitResourceTrackingProjectSyncMessage.channel_name,
        RabbitResourceTrackingProjectSyncMessage(
            project_id=project_uuid, project_tags=project_tags
        ),
    )

    # Override project access rights
    if project["workspaceId"] is not None:
        workspace_db: UserWorkspaceAccessRightsDB = (
            await workspaces_db.get_workspace_for_user(
                app=app,
                user_id=user_id,
                workspace_id=project["workspaceId"],
                product_name=product_name,
            )
        )
        project["accessRights"] = {
            gid: access.dict() for gid, access in workspace_db.access_rights.items()
        }

    return project


async def remove_tag(
    app: web.Application, user_id: UserID, project_uuid: ProjectID, tag_id: int
) -> ProjectDict:
    db: ProjectDBAPI = ProjectDBAPI.get_from_app_context(app)

    product_name = await db.get_project_product(project_uuid)
    await check_user_project_permission(
        app,
        project_id=project_uuid,
        user_id=user_id,
        product_name=product_name,
        permission="write",
    )

    project: ProjectDict = await db.remove_tag(
        project_uuid=f"{project_uuid}", user_id=user_id, tag_id=tag_id
    )

    if project["workspaceId"] is not None:
        workspace_db: UserWorkspaceAccessRightsDB = (
            await workspaces_db.get_workspace_for_user(
                app=app,
                user_id=user_id,
                workspace_id=project["workspaceId"],
                product_name=product_name,
            )
        )
        project["accessRights"] = {
            gid: access.dict() for gid, access in workspace_db.access_rights.items()
        }

    return project
