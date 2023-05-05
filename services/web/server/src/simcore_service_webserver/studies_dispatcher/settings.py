from datetime import timedelta

from aiohttp import web
from pydantic import ByteSize, HttpUrl, parse_obj_as, validator
from pydantic.fields import Field
from servicelib.aiohttp.application_keys import APP_SETTINGS_KEY
from settings_library.base import BaseCustomSettings


class StudiesDispatcherSettings(BaseCustomSettings):
    STUDIES_ACCESS_ANONYMOUS_ALLOWED: bool = Field(
        False,
        description="If enabled, the study links are accessible to anonymous users",
        env=["STUDIES_ACCESS_ANONYMOUS_ALLOWED", "WEBSERVER_STUDIES_ACCESS_ENABLED"],
    )

    STUDIES_GUEST_ACCOUNT_LIFETIME: timedelta = Field(
        default=timedelta(minutes=15),
        description="Sets lifetime of a guest user until it is logged out "
        " and removed by the GC",
    )

    STUDIES_DEFAULT_SERVICE_THUMBNAIL: HttpUrl = Field(
        default=parse_obj_as(HttpUrl, "https://via.placeholder.com/170x120.png"),
        description="Default thumbnail for services or dispatch project with a service",
    )

    STUDIES_DEFAULT_FILE_THUMBNAIL: HttpUrl = Field(
        default=parse_obj_as(HttpUrl, "https://via.placeholder.com/170x120.png"),
        description="Default thumbnail for dispatch projects with only data (i.e. file-picker)",
    )

    STUDIES_MAX_FILE_SIZE_ALLOWED: ByteSize = Field(
        default=parse_obj_as(ByteSize, "50Mib"),
        description="Limits the size of the files that can be dispatched"
        "Note that the accuracy of the file size is not guaranteed and this limit might be surpassed",
    )

    @validator("STUDIES_GUEST_ACCOUNT_LIFETIME")
    @classmethod
    def is_positive_lifetime(cls, v):
        if v and isinstance(v, timedelta) and v.total_seconds() <= 0:
            raise ValueError(f"Must be a positive number, got {v.total_seconds()=}")
        return v

    def is_login_required(self):
        """Used just to allow protecting the dispatcher redirect entrypoint programatically
        Normally dispatcher entrypoints are openened
        """
        return not self.STUDIES_ACCESS_ANONYMOUS_ALLOWED

    class Config:
        schema_extra = {
            "example": {
                "STUDIES_GUEST_ACCOUNT_LIFETIME": "2 1:10:00",  # 2 days 1h and 10 mins
                "STUDIES_ACCESS_ANONYMOUS_ALLOWED": "1",
            },
        }


def get_plugin_settings(app: web.Application) -> StudiesDispatcherSettings:
    settings = app[APP_SETTINGS_KEY].WEBSERVER_STUDIES_DISPATCHER
    assert settings, "setup_settings not called?"  # nosec
    assert isinstance(settings, StudiesDispatcherSettings)  # nosec
    return settings
