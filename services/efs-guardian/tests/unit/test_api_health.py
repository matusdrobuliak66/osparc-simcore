# pylint:disable=unused-variable
# pylint:disable=unused-argument
# pylint:disable=redefined-outer-name

import httpx
import pytest
from pytest_simcore.helpers.utils_envs import EnvVarsDict
from starlette import status

pytest_simcore_core_services_selection = []

pytest_simcore_ops_services_selection = []


@pytest.fixture
def app_environment(
    app_environment: EnvVarsDict,
) -> EnvVarsDict:
    return app_environment


async def test_healthcheck(async_client: httpx.AsyncClient):
    response = await async_client.get("/")
    response.raise_for_status()
    assert response.status_code == status.HTTP_200_OK
    assert "simcore_service_efs_guardian" in response.text