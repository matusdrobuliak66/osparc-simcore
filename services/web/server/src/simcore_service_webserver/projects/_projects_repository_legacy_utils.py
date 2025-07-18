import logging
from collections.abc import Mapping
from copy import deepcopy
from datetime import datetime
from enum import Enum
from typing import Any, Literal, cast

import sqlalchemy as sa
from aiopg.sa.connection import SAConnection
from aiopg.sa.result import RowProxy
from models_library.projects import ProjectID, ProjectType
from models_library.projects_nodes import Node
from models_library.projects_nodes_io import NodeIDStr
from models_library.utils.change_case import camel_to_snake, snake_to_camel
from pydantic import ValidationError
from simcore_postgres_database.models.project_to_groups import project_to_groups
from simcore_postgres_database.webserver_models import (
    ProjectTemplateType as ProjectTemplateTypeDB,
)
from simcore_postgres_database.webserver_models import ProjectType as ProjectTypeDB
from simcore_postgres_database.webserver_models import (
    projects,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert

from ..db.models import GroupType, groups, projects_tags, user_to_groups, users
from ..users.exceptions import UserNotFoundError
from ..utils import format_datetime
from ._projects_repository import PROJECT_DB_COLS
from .exceptions import (
    NodeNotFoundError,
    ProjectInvalidUsageError,
    ProjectNotFoundError,
)
from .models import ProjectDict
from .utils import find_changed_node_keys

logger = logging.getLogger(__name__)

DB_EXCLUSIVE_COLUMNS = ["id", "published", "hidden"]
SCHEMA_NON_NULL_KEYS = ["thumbnail"]

PermissionStr = Literal["read", "write", "delete"]

ANY_USER_ID_SENTINEL = -1


class ProjectAccessRights(Enum):
    # NOTE: PC->SAN: enum with dict as values is unual. need to review
    OWNER = {"read": True, "write": True, "delete": True}
    COLLABORATOR = {"read": True, "write": True, "delete": False}
    VIEWER = {"read": True, "write": False, "delete": False}


def create_project_access_rights(
    gid: int, access: ProjectAccessRights
) -> dict[str, dict[str, bool]]:
    return {f"{gid}": access.value}


def convert_to_db_names(project_document_data: dict) -> dict:
    # NOTE: this has to be moved to a proper model. check here how schema to model db works!?
    # SEE: https://github.com/ITISFoundation/osparc-simcore/issues/3516
    converted_args = {}
    exclude_keys = [
        "tags",
        "prjOwner",
        "folderId",
        "trashedByPrimaryGid",
        "trashed_by_primary_gid",
    ]  # No column for tags, prjOwner is a foreign key in db
    for key, value in project_document_data.items():
        if key not in exclude_keys:
            converted_args[camel_to_snake(key)] = value

    # ensures UUIDs e.g. are converted to str
    if uid := converted_args.get("uuid"):
        converted_args["uuid"] = f"{uid}"

    return converted_args


def convert_to_schema_names(
    project_database_data: Mapping, user_email: str, **kwargs
) -> dict:
    # SEE https://github.com/ITISFoundation/osparc-simcore/issues/3516
    converted_args = {}
    for col_name, col_value in project_database_data.items():
        if col_name in DB_EXCLUSIVE_COLUMNS:
            continue
        converted_value = col_value
        if isinstance(col_value, datetime) and col_name not in {"trashed"}:
            converted_value = format_datetime(col_value)
        if col_name == "prj_owner":
            # this entry has to be converted to the owner e-mail address
            converted_value = user_email
        if col_name == "type" and isinstance(col_value, ProjectTypeDB):
            converted_value = col_value.value
        if col_name == "template_type" and isinstance(col_value, ProjectTemplateTypeDB):
            converted_value = col_value.value

        if col_name in SCHEMA_NON_NULL_KEYS and col_value is None:
            converted_value = ""

        converted_args[snake_to_camel(col_name)] = converted_value
    converted_args.update(**kwargs)
    return converted_args


def assemble_array_groups(user_groups: list[RowProxy]) -> str:
    return (
        "array[]::text[]"
        if len(user_groups) == 0
        else f"""array[{', '.join(f"'{group.gid}'" for group in user_groups)}]"""
    )


class BaseProjectDB:
    @classmethod
    async def _get_everyone_group(cls, conn: SAConnection) -> RowProxy:
        result = await conn.execute(
            sa.select(groups).where(groups.c.type == GroupType.EVERYONE)
        )
        row = await result.first()
        assert row is not None  # nosec
        return cast(RowProxy, row)  # mypy: not sure why this cast is necessary

    @classmethod
    async def _list_user_groups(
        cls, conn: SAConnection, user_id: int
    ) -> list[RowProxy]:
        user_groups = []

        if user_id == ANY_USER_ID_SENTINEL:
            everyone_group = await cls._get_everyone_group(conn)
            assert everyone_group  # nosec
            user_groups.append(everyone_group)
        else:
            result = await conn.execute(
                sa.select(groups)
                .select_from(groups.join(user_to_groups))
                .where(user_to_groups.c.uid == user_id)
            )
            user_groups = await result.fetchall() or []
        return user_groups

    @staticmethod
    async def _get_user_email(conn: SAConnection, user_id: int | None) -> str:
        if not user_id:
            return "not_a_user@unknown.com"
        email = await conn.scalar(sa.select(users.c.email).where(users.c.id == user_id))
        assert isinstance(email, str) or email is None  # nosec
        return email or "Unknown"

    @staticmethod
    async def _get_user_primary_group_gid(conn: SAConnection, user_id: int) -> int:
        primary_gid = await conn.scalar(
            sa.select(users.c.primary_gid).where(users.c.id == str(user_id))
        )
        if not primary_gid:
            raise UserNotFoundError(user_id=user_id)
        assert isinstance(primary_gid, int)
        return primary_gid

    @staticmethod
    async def _get_tags_by_project(conn: SAConnection, project_id: str) -> list:
        query = sa.select(projects_tags.c.tag_id).where(
            projects_tags.c.project_id == project_id
        )
        return [row.tag_id async for row in conn.execute(query)]

    @staticmethod
    async def _upsert_tags_in_project(
        conn: SAConnection,
        project_index_id: int,
        project_uuid: ProjectID,
        project_tags: list[int],
    ) -> None:
        for tag_id in project_tags:
            await conn.execute(
                pg_insert(projects_tags)
                .values(
                    project_id=project_index_id,
                    tag_id=tag_id,
                    project_uuid_for_rut=project_uuid,
                )
                .on_conflict_do_nothing()
            )

    async def _get_project(
        self,
        connection: SAConnection,
        project_uuid: str,
        *,
        exclude_foreign: list[str] | None = None,
        for_update: bool = False,
        only_templates: bool = False,
        only_published: bool = False,
    ) -> dict:
        """
        raises ProjectNotFoundError if project does not exists
        """
        exclude_foreign = exclude_foreign or []

        access_rights_subquery = (
            sa.select(
                project_to_groups.c.project_uuid,
                sa.func.jsonb_object_agg(
                    project_to_groups.c.gid,
                    sa.func.jsonb_build_object(
                        "read",
                        project_to_groups.c.read,
                        "write",
                        project_to_groups.c.write,
                        "delete",
                        project_to_groups.c.delete,
                    ),
                ).label("access_rights"),
            )
            .where(project_to_groups.c.project_uuid == f"{project_uuid}")
            .group_by(project_to_groups.c.project_uuid)
        ).subquery("access_rights_subquery")

        query = (
            sa.select(
                *PROJECT_DB_COLS,
                projects.c.workbench,
                users.c.primary_gid.label("trashed_by_primary_gid"),
                access_rights_subquery.c.access_rights,
            )
            .select_from(
                projects.join(access_rights_subquery, isouter=True).outerjoin(
                    users, projects.c.trashed_by == users.c.id
                )
            )
            .where(
                (projects.c.uuid == f"{project_uuid}")
                & (
                    projects.c.type == f"{ProjectType.TEMPLATE.value}"
                    if only_templates
                    else True
                )
            )
        )

        if only_published:
            query = query.where(projects.c.published == "true")

        if for_update:
            # NOTE: It seems that blocking this row in the database is necessary; otherwise, there are some concurrency issues.
            # As the WITH FOR UPDATE clause cannot be used with the GROUP BY clause, I have added a separate query for that.
            blocking_query = (
                sa.select(projects).where(projects.c.uuid == f"{project_uuid}")
            ).with_for_update()
            await connection.execute(blocking_query)

        result = await connection.execute(query)
        project_row = await result.first()

        if not project_row:
            raise ProjectNotFoundError(
                project_uuid=project_uuid,
                search_context=f"{only_templates=}, {only_published=}",
            )

        project: dict[str, Any] = dict(project_row.items())

        if "tags" not in exclude_foreign:
            tags = await self._get_tags_by_project(
                connection, project_id=project_row.id
            )
            project["tags"] = tags

        return project


def update_workbench(old_project: ProjectDict, new_project: ProjectDict) -> ProjectDict:
    """any non set entry in the new workbench is taken from the old one if available

    Raises:
        ProjectInvalidUsageError: it is not allowed to add/remove nodes

    Returns:
        udpated project
    """

    old_workbench: dict[NodeIDStr, Any] = old_project["workbench"]
    updated_project = deepcopy(new_project)
    new_workbench: dict[NodeIDStr, Any] = updated_project["workbench"]

    if old_workbench.keys() != new_workbench.keys():
        # it is forbidden to add/remove nodes here
        raise ProjectInvalidUsageError
    for node_key, node in new_workbench.items():
        old_node = old_workbench.get(node_key)
        if not old_node:
            continue
        for prop in old_node:
            # check if the key is missing in the new node
            if prop not in node:
                # use the old value
                node[prop] = old_node[prop]
    return updated_project


def patch_workbench(
    project: ProjectDict,
    *,
    new_partial_workbench_data: dict[NodeIDStr, Any],
    allow_workbench_changes: bool,
) -> tuple[ProjectDict, dict[NodeIDStr, Any]]:
    """patch the project workbench with the values in new_partial_workbench_data

    - Example: to add a node: ```{new_node_id: {"key": node_key, "version": node_version, "label": node_label, ...}}```
    - Example: to modify a node ```{new_node_id: {"outputs": {"output_1": 2}}}```
    - Example: to remove a node ```{node_id: None}```


    Raises:
        ProjectInvalidUsageError: if allow_workbench_changes is False and user tries to add/remove nodes
        NodeNotFoundError: obviously the node does not exist and cannot be patched

    Returns:
        patched project and changed entries
    """
    patched_project = deepcopy(project)
    changed_entries = {}
    for (
        node_key,
        new_node_data,
    ) in new_partial_workbench_data.items():
        current_node_data: dict[str, Any] | None = patched_project.get(
            "workbench", {}
        ).get(node_key)

        if current_node_data is None:
            if not allow_workbench_changes:
                raise ProjectInvalidUsageError
            # if it's a new node, let's check that it validates
            try:
                Node.model_validate(new_node_data)
                patched_project["workbench"][node_key] = new_node_data
                changed_entries.update({node_key: new_node_data})
            except ValidationError as err:
                raise NodeNotFoundError(
                    project_uuid=patched_project["uuid"], node_uuid=node_key
                ) from err
        elif new_node_data is None:
            if not allow_workbench_changes:
                raise ProjectInvalidUsageError
            # remove the node
            patched_project["workbench"].pop(node_key)
            changed_entries.update({node_key: None})
        else:
            # find changed keys
            changed_entries.update(
                {
                    node_key: find_changed_node_keys(
                        current_node_data,
                        new_node_data,
                        look_for_removed_keys=False,
                    )
                }
            )
            # patch
            current_node_data.update(new_node_data)
    return (patched_project, changed_entries)
