# pylint: disable=redefined-outer-name
# pylint: disable=unused-argument
# pylint: disable=unused-variable
"""
We can validate actual .env files (also refered as `repo.config` files) by passing them via the CLI

$ ln -s /path/to/osparc-config/deployments/mydeploy.com/repo.config .secrets
$ pytest --external-envfile=.secrets --pdb tests/unit/test_core_settings.py

"""

from pytest_simcore.helpers.monkeypatch_envs import EnvVarsDict
from simcore_service_efs_guardian.core.settings import ApplicationSettings


def test_valid_application_settings(app_environment: EnvVarsDict):
    assert app_environment

    settings = ApplicationSettings()  # type: ignore
    assert settings

    assert settings == ApplicationSettings.create_from_envs()
    assert settings.EFS_GUARDIAN_POSTGRES
