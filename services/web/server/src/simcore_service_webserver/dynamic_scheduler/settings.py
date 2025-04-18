import datetime

from aiohttp import web
from pydantic import AliasChoices, Field
from settings_library.base import BaseCustomSettings
from settings_library.utils_service import MixinServiceSettings

from ..constants import APP_SETTINGS_KEY


class DynamicSchedulerSettings(BaseCustomSettings, MixinServiceSettings):
    DYNAMIC_SCHEDULER_STOP_SERVICE_TIMEOUT: datetime.timedelta = Field(
        datetime.timedelta(hours=1, seconds=10),
        description=(
            "Timeout on stop service request"
            "ANE: The below will try to help explaining what is happening: "
            "webserver -(stop_service)-> dynamic-scheduler -(relays the stop)-> "
            "director-v* -(save_state)-> service_x"
            "- webserver requests stop_service and uses a 01:00:10 timeout"
            "- director-v* requests save_state and uses a 01:00:00 timeout"
            "The +10 seconds is used to make sure the director replies"
        ),
        validation_alias=AliasChoices(
            "DIRECTOR_V2_STOP_SERVICE_TIMEOUT",
            "DYNAMIC_SCHEDULER_STOP_SERVICE_TIMEOUT",
        ),
    )

    DYNAMIC_SCHEDULER_RESTART_USER_SERVICES_TIMEOUT: datetime.timedelta = Field(
        datetime.timedelta(minutes=1), description="timeout for user services restart"
    )

    DYNAMIC_SCHEDULER_SERVICE_UPLOAD_DOWNLOAD_TIMEOUT: datetime.timedelta = Field(
        datetime.timedelta(hours=1),
        description=(
            "When dynamic services upload and download data from storage, "
            "sometimes very big payloads are involved. In order to handle "
            "such payloads it is required to have long timeouts which "
            "allow the service to finish the operation."
        ),
    )


def get_plugin_settings(app: web.Application) -> DynamicSchedulerSettings:
    settings = app[APP_SETTINGS_KEY].WEBSERVER_DYNAMIC_SCHEDULER
    assert settings, "setup_settings not called?"  # nosec
    assert isinstance(settings, DynamicSchedulerSettings)  # nosec
    return settings
