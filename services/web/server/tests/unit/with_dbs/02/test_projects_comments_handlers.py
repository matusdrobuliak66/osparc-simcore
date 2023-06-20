# pylint: disable=protected-access
# pylint: disable=redefined-outer-name
# pylint: disable=too-many-arguments
# pylint: disable=unused-argument
# pylint: disable=unused-variable


from typing import Any

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient
from pytest_simcore.helpers.utils_login import LoggedUser
from simcore_postgres_database.models.projects import projects
from simcore_service_webserver._meta import api_version_prefix
from simcore_service_webserver.db.models import UserRole

API_PREFIX = "/" + api_version_prefix


@pytest.mark.parametrize(
    "user_role,expected",
    [
        (UserRole.ANONYMOUS, web.HTTPUnauthorized),
        (UserRole.GUEST, web.HTTPOk),
        (UserRole.USER, web.HTTPOk),
        (UserRole.TESTER, web.HTTPOk),
    ],
)
async def test_project_comments_user_role_access(
    client: TestClient,
    logged_user: dict[str, Any],
    user_project: dict[str, Any],
    template_project: dict[str, Any],
    user_role: UserRole,
    expected: type[web.HTTPException],
):
    base_url = client.app.router["list_project_comments"].url_for(
        project_uuid=user_project["uuid"]
    )
    resp = await client.get(base_url)
    assert resp.status == 401 if user_role == UserRole.ANONYMOUS else 200


@pytest.mark.parametrize(
    "user_role,expected",
    [
        (UserRole.USER, web.HTTPOk),
    ],
)
async def test_project_comments_basic_crud_operations(
    client: TestClient,
    logged_user: dict[str, Any],
    user_project: dict[str, Any],
    template_project: dict[str, Any],
    expected: type[web.HTTPException],
    postgres_db,
):
    base_url = client.app.router["list_project_comments"].url_for(
        project_uuid=user_project["uuid"]
    )
    resp = await client.get(base_url)
    data = await resp.json()
    assert resp.status == 200
    assert data["data"] == []

    # Now we will add first comment
    body = {"content": "My first comment", "user_id": logged_user["id"]}
    resp = await client.post(base_url, json=body)
    assert resp.status == 201
    data = await resp.json()
    first_comment_id = data["data"]

    # Now we will add second comment
    resp = await client.post(
        base_url, json={"content": "My second comment", "user_id": logged_user["id"]}
    )
    assert resp.status == 201
    data = await resp.json()
    second_comment_id = data["data"]

    # Now we will list all comments for the project
    resp = await client.get(base_url)
    data = await resp.json()
    assert resp.status == 200
    assert len(data["data"]) == 2

    # Now we will update the second comment
    updated_comment = "Updated second comment"
    resp = await client.put(
        base_url / f"{second_comment_id}",
        json={"content": updated_comment, "user_id": logged_user["id"]},
    )
    data = await resp.json()
    assert resp.status == 200
    assert data["data"]["content"] == updated_comment

    # Now we will get the second comment
    resp = await client.get(base_url / f"{second_comment_id}")
    data = await resp.json()
    assert resp.status == 200
    assert data["data"]["content"] == updated_comment

    # Now we will delete the second comment
    resp = await client.delete(base_url / f"{second_comment_id}")
    data = await resp.json()
    assert resp.status == 204

    # Now we will list all comments for the project
    resp = await client.get(base_url)
    data = await resp.json()
    assert resp.status == 200
    assert len(data["data"]) == 1

    # Now we will log as a different user
    async with LoggedUser(client) as new_logged_user:
        # As this user does not have access to the project, they should get 404
        resp = await client.get(base_url)
        data = await resp.json()
        assert resp.status == 404

        resp = await client.get(base_url / f"{first_comment_id}")
        data = await resp.json()
        assert resp.status == 404

        # Now we will share the project with the new user
        with postgres_db.connect() as con:
            result = con.execute(
                projects.update()
                .values(
                    **{
                        "access_rights": {
                            str(logged_user["primary_gid"]): {
                                "read": True,
                                "write": True,
                                "delete": True,
                            },
                            str(new_logged_user["primary_gid"]): {
                                "read": True,
                                "write": True,
                                "delete": True,
                            },
                        }
                    }
                )
                .where(projects.c.uuid == user_project["uuid"])
            )

        # Now the user should have access to the project now
        # New user will add comment
        resp = await client.post(
            base_url,
            json={
                "content": "My first comment as a new user",
                "user_id": new_logged_user["id"],
            },
        )
        assert resp.status == 201
        data = await resp.json()
        new_user_comment_id = data["data"]

        # New user will modify the comment
        updated_comment = "Updated My first comment as a new user"
        resp = await client.put(
            base_url / f"{new_user_comment_id}",
            json={"content": updated_comment, "user_id": new_logged_user["id"]},
        )
        data = await resp.json()
        assert resp.status == 200
        assert data["data"]["content"] == updated_comment

        # New user will list all comments
        resp = await client.get(base_url)
        data = await resp.json()
        assert resp.status == 200
        assert len(data["data"]) == 2

        # New user will modify comment of the previous user
        updated_comment = "Updated comment of previous user"
        resp = await client.put(
            base_url / f"{first_comment_id}",
            json={"content": updated_comment, "user_id": new_logged_user["id"]},
        )
        data = await resp.json()
        assert resp.status == 200
        assert data["data"]["content"] == updated_comment

        # New user will delete comment of the previous user
        resp = await client.delete(base_url / f"{first_comment_id}")
        data = await resp.json()
        assert resp.status == 204
