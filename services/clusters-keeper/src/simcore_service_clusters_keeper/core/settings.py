import datetime
from functools import cached_property
from typing import Annotated, Final, Literal, cast

from aws_library.ec2 import EC2InstanceBootSpecific, EC2Tags
from common_library.basic_types import DEFAULT_FACTORY
from fastapi import FastAPI
from models_library.basic_types import (
    BootModeEnum,
    BuildTargetEnum,
    LogLevel,
    VersionTag,
)
from models_library.clusters import ClusterAuthentication
from pydantic import (
    AliasChoices,
    Field,
    NonNegativeFloat,
    NonNegativeInt,
    PositiveInt,
    SecretStr,
    TypeAdapter,
    field_validator,
)
from pydantic_settings import SettingsConfigDict
from servicelib.logging_utils import LogLevelInt
from servicelib.logging_utils_filtering import LoggerName, MessageSubstring
from settings_library.base import BaseCustomSettings
from settings_library.docker_registry import RegistrySettings
from settings_library.ec2 import EC2Settings
from settings_library.rabbit import RabbitSettings
from settings_library.redis import RedisSettings
from settings_library.ssm import SSMSettings
from settings_library.tracing import TracingSettings
from settings_library.utils_logging import MixinLoggingSettings
from types_aiobotocore_ec2.literals import InstanceTypeType

from .._meta import API_VERSION, API_VTAG, APP_NAME

CLUSTERS_KEEPER_ENV_PREFIX: Final[str] = "CLUSTERS_KEEPER_"


class ClustersKeeperEC2Settings(EC2Settings):
    model_config = SettingsConfigDict(
        env_prefix=CLUSTERS_KEEPER_ENV_PREFIX,
        json_schema_extra={
            "examples": [
                {
                    f"{CLUSTERS_KEEPER_ENV_PREFIX}EC2_ACCESS_KEY_ID": "my_access_key_id",
                    f"{CLUSTERS_KEEPER_ENV_PREFIX}EC2_ENDPOINT": "https://my_ec2_endpoint.com",
                    f"{CLUSTERS_KEEPER_ENV_PREFIX}EC2_REGION_NAME": "us-east-1",
                    f"{CLUSTERS_KEEPER_ENV_PREFIX}EC2_SECRET_ACCESS_KEY": "my_secret_access_key",
                }
            ],
        },
    )


class ClustersKeeperSSMSettings(SSMSettings):
    model_config = SettingsConfigDict(
        env_prefix=CLUSTERS_KEEPER_ENV_PREFIX,
        json_schema_extra={
            "examples": [
                {
                    f"{CLUSTERS_KEEPER_ENV_PREFIX}{key}": var
                    for key, var in example.items()  # type:ignore[union-attr]
                }
                for example in SSMSettings.model_config[  # type:ignore[union-attr,index]
                    "json_schema_extra"
                ][
                    "examples"
                ]
            ],
        },
    )


class WorkersEC2InstancesSettings(BaseCustomSettings):
    WORKERS_EC2_INSTANCES_ALLOWED_TYPES: Annotated[
        dict[str, EC2InstanceBootSpecific],
        Field(
            description="Defines which EC2 instances are considered as candidates for new EC2 instance and their respective boot specific parameters",
        ),
    ]

    WORKERS_EC2_INSTANCES_KEY_NAME: Annotated[
        str,
        Field(
            min_length=1,
            description="SSH key filename (without ext) to access the instance through SSH"
            " (https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html),"
            "this is required to start a new EC2 instance",
        ),
    ]
    # BUFFER is not exposed since we set it to 0
    WORKERS_EC2_INSTANCES_MAX_START_TIME: Annotated[
        datetime.timedelta,
        Field(
            description="Usual time taken an EC2 instance with the given AMI takes to join the cluster "
            "(default to seconds, or see https://pydantic-docs.helpmanual.io/usage/types/#datetime-types for string formating)."
            "NOTE: be careful that this time should always be a factor larger than the real time, as EC2 instances"
            "that take longer than this time will be terminated as sometimes it happens that EC2 machine fail on start.",
        ),
    ] = datetime.timedelta(minutes=1)
    WORKERS_EC2_INSTANCES_MAX_INSTANCES: Annotated[
        int,
        Field(
            description="Defines the maximum number of instances the clusters_keeper app may create",
        ),
    ] = 10
    # NAME PREFIX is not exposed since we override it anyway
    WORKERS_EC2_INSTANCES_SECURITY_GROUP_IDS: Annotated[
        list[str],
        Field(
            min_length=1,
            description="A security group acts as a virtual firewall for your EC2 instances to control incoming and outgoing traffic"
            " (https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html), "
            " this is required to start a new EC2 instance",
        ),
    ]
    WORKERS_EC2_INSTANCES_SUBNET_ID: Annotated[
        str,
        Field(
            min_length=1,
            description="A subnet is a range of IP addresses in your VPC "
            " (https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html), "
            "this is required to start a new EC2 instance",
        ),
    ]

    WORKERS_EC2_INSTANCES_TIME_BEFORE_DRAINING: Annotated[
        datetime.timedelta,
        Field(
            description="Time after which an EC2 instance may be terminated (min 0 max 1 minute) "
            "(default to seconds, or see https://pydantic-docs.helpmanual.io/usage/types/#datetime-types for string formating)",
        ),
    ] = datetime.timedelta(minutes=1)

    WORKERS_EC2_INSTANCES_TIME_BEFORE_TERMINATION: Annotated[
        datetime.timedelta,
        Field(
            description="Time after which an EC2 instance may be terminated (min 0, max 59 minutes) "
            "(default to seconds, or see https://pydantic-docs.helpmanual.io/usage/types/#datetime-types for string formating)",
        ),
    ] = datetime.timedelta(minutes=3)

    WORKERS_EC2_INSTANCES_CUSTOM_TAGS: Annotated[
        EC2Tags,
        Field(
            description="Allows to define tags that should be added to the created EC2 instance default tags. "
            "a tag must have a key and an optional value. see [https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Using_Tags.html]",
        ),
    ]

    @field_validator("WORKERS_EC2_INSTANCES_ALLOWED_TYPES")
    @classmethod
    def _check_valid_instance_names(
        cls, value: dict[str, EC2InstanceBootSpecific]
    ) -> dict[str, EC2InstanceBootSpecific]:
        # NOTE: needed because of a flaw in BaseCustomSettings
        # issubclass raises TypeError if used on Aliases
        TypeAdapter(list[InstanceTypeType]).validate_python(list(value))
        return value


class PrimaryEC2InstancesSettings(BaseCustomSettings):
    PRIMARY_EC2_INSTANCES_ALLOWED_TYPES: Annotated[
        dict[str, EC2InstanceBootSpecific],
        Field(
            description="Defines which EC2 instances are considered as candidates for new EC2 instance and their respective boot specific parameters",
        ),
    ]

    PRIMARY_EC2_INSTANCES_MAX_INSTANCES: Annotated[
        int,
        Field(
            description="Defines the maximum number of instances the clusters_keeper app may create",
        ),
    ] = 10
    PRIMARY_EC2_INSTANCES_SECURITY_GROUP_IDS: Annotated[
        list[str],
        Field(
            min_length=1,
            description="A security group acts as a virtual firewall for your EC2 instances to control incoming and outgoing traffic"
            " (https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html), "
            " this is required to start a new EC2 instance",
        ),
    ]
    PRIMARY_EC2_INSTANCES_SUBNET_ID: Annotated[
        str,
        Field(
            min_length=1,
            description="A subnet is a range of IP addresses in your VPC "
            " (https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html), "
            "this is required to start a new EC2 instance",
        ),
    ]

    PRIMARY_EC2_INSTANCES_KEY_NAME: Annotated[
        str,
        Field(
            min_length=1,
            description="SSH key filename (without ext) to access the instance through SSH"
            " (https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html),"
            "this is required to start a new EC2 instance",
        ),
    ]
    PRIMARY_EC2_INSTANCES_CUSTOM_TAGS: Annotated[
        EC2Tags,
        Field(
            description="Allows to define tags that should be added to the created EC2 instance default tags. "
            "a tag must have a key and an optional value. see [https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Using_Tags.html]",
        ),
    ]
    PRIMARY_EC2_INSTANCES_ATTACHED_IAM_PROFILE: Annotated[
        str,
        Field(
            description="ARN the EC2 instance should be attached to (example: arn:aws:iam::XXXXX:role/NAME), to disable pass an empty string",
        ),
    ]
    PRIMARY_EC2_INSTANCES_SSM_TLS_DASK_CA: Annotated[
        str, Field(description="Name of the dask TLC CA in AWS Parameter Store")
    ]
    PRIMARY_EC2_INSTANCES_SSM_TLS_DASK_CERT: Annotated[
        str,
        Field(description="Name of the dask TLC certificate in AWS Parameter Store"),
    ]
    PRIMARY_EC2_INSTANCES_SSM_TLS_DASK_KEY: Annotated[
        str, Field(description="Name of the dask TLC key in AWS Parameter Store")
    ]
    PRIMARY_EC2_INSTANCES_PROMETHEUS_USERNAME: Annotated[
        str, Field(description="Username for accessing prometheus data")
    ]
    PRIMARY_EC2_INSTANCES_PROMETHEUS_PASSWORD: Annotated[
        SecretStr, Field(description="Password for accessing prometheus data")
    ]

    PRIMARY_EC2_INSTANCES_MAX_START_TIME: Annotated[
        datetime.timedelta,
        Field(
            description="Usual time taken an EC2 instance with the given AMI takes to startup and be ready to receive jobs "
            "(default to seconds, or see https://pydantic-docs.helpmanual.io/usage/types/#datetime-types for string formating)."
            "NOTE: be careful that this time should always be a factor larger than the real time, as EC2 instances"
            "that take longer than this time will be terminated as sometimes it happens that EC2 machine fail on start.",
        ),
    ] = datetime.timedelta(minutes=2)

    PRIMARY_EC2_INSTANCES_DOCKER_DEFAULT_ADDRESS_POOL: Annotated[
        str,
        Field(
            description="defines the docker swarm default address pool in CIDR format "
            "(see https://docs.docker.com/reference/cli/docker/swarm/init/)",
        ),
    ] = "172.20.0.0/14"  # nosec

    PRIMARY_EC2_INSTANCES_RABBIT: Annotated[
        RabbitSettings | None,
        Field(
            description="defines the Rabbit settings for the primary instance (may be disabled)",
            json_schema_extra={"auto_default_from_env": True},
        ),
    ]

    @field_validator("PRIMARY_EC2_INSTANCES_ALLOWED_TYPES")
    @classmethod
    def _check_valid_instance_names(
        cls, value: dict[str, EC2InstanceBootSpecific]
    ) -> dict[str, EC2InstanceBootSpecific]:
        # NOTE: needed because of a flaw in BaseCustomSettings
        # issubclass raises TypeError if used on Aliases
        TypeAdapter(list[InstanceTypeType]).validate_python(list(value))
        return value

    @field_validator("PRIMARY_EC2_INSTANCES_ALLOWED_TYPES")
    @classmethod
    def _check_only_one_value(
        cls, value: dict[str, EC2InstanceBootSpecific]
    ) -> dict[str, EC2InstanceBootSpecific]:
        if len(value) != 1:
            msg = "Only one exact value is accepted (empty or multiple is invalid)"
            raise ValueError(msg)

        return value


class ApplicationSettings(BaseCustomSettings, MixinLoggingSettings):
    # CODE STATICS ---------------------------------------------------------
    API_VERSION: str = API_VERSION
    APP_NAME: str = APP_NAME
    API_VTAG: VersionTag = API_VTAG

    # IMAGE BUILDTIME ------------------------------------------------------
    # @Makefile
    SC_BUILD_DATE: str | None = None
    SC_BUILD_TARGET: BuildTargetEnum | None = None
    SC_VCS_REF: str | None = None
    SC_VCS_URL: str | None = None

    # @Dockerfile
    SC_BOOT_MODE: BootModeEnum | None = None
    SC_BOOT_TARGET: BuildTargetEnum | None = None
    SC_HEALTHCHECK_TIMEOUT: Annotated[
        PositiveInt | None,
        Field(
            description="If a single run of the check takes longer than timeout seconds "
            "then the check is considered to have failed."
            "It takes retries consecutive failures of the health check for the container to be considered unhealthy.",
        ),
    ] = None
    SC_USER_ID: int | None = None
    SC_USER_NAME: str | None = None

    # RUNTIME  -----------------------------------------------------------
    CLUSTERS_KEEPER_DEBUG: Annotated[
        bool,
        Field(
            default=False,
            description="Debug mode",
            validation_alias=AliasChoices("CLUSTERS_KEEPER_DEBUG", "DEBUG"),
        ),
    ] = False
    CLUSTERS_KEEPER_LOGLEVEL: Annotated[
        LogLevel,
        Field(
            validation_alias=AliasChoices(
                "CLUSTERS_KEEPER_LOGLEVEL", "LOG_LEVEL", "LOGLEVEL"
            ),
        ),
    ] = LogLevel.INFO
    CLUSTERS_KEEPER_LOG_FORMAT_LOCAL_DEV_ENABLED: Annotated[
        bool,
        Field(
            validation_alias=AliasChoices(
                "CLUSTERS_KEEPER_LOG_FORMAT_LOCAL_DEV_ENABLED",
                "LOG_FORMAT_LOCAL_DEV_ENABLED",
            ),
            description="Enables local development log format. WARNING: make sure it is disabled if you want to have structured logs!",
        ),
    ] = False
    CLUSTERS_KEEPER_LOG_FILTER_MAPPING: Annotated[
        dict[LoggerName, list[MessageSubstring]],
        Field(
            default_factory=dict,
            validation_alias=AliasChoices(
                "CLUSTERS_KEEPER_LOG_FILTER_MAPPING", "LOG_FILTER_MAPPING"
            ),
            description="is a dictionary that maps specific loggers (such as 'uvicorn.access' or 'gunicorn.access') to a list of log message patterns that should be filtered out.",
        ),
    ] = DEFAULT_FACTORY

    CLUSTERS_KEEPER_EC2_ACCESS: Annotated[
        ClustersKeeperEC2Settings | None,
        Field(json_schema_extra={"auto_default_from_env": True}),
    ]

    CLUSTERS_KEEPER_SSM_ACCESS: Annotated[
        ClustersKeeperSSMSettings | None,
        Field(json_schema_extra={"auto_default_from_env": True}),
    ]

    CLUSTERS_KEEPER_PRIMARY_EC2_INSTANCES: Annotated[
        PrimaryEC2InstancesSettings | None,
        Field(json_schema_extra={"auto_default_from_env": True}),
    ]

    CLUSTERS_KEEPER_WORKERS_EC2_INSTANCES: Annotated[
        WorkersEC2InstancesSettings | None,
        Field(json_schema_extra={"auto_default_from_env": True}),
    ]

    CLUSTERS_KEEPER_EC2_INSTANCES_PREFIX: Annotated[
        str,
        Field(
            description="set a prefix to all machines created (useful for testing)",
        ),
    ]

    CLUSTERS_KEEPER_RABBITMQ: Annotated[
        RabbitSettings | None, Field(json_schema_extra={"auto_default_from_env": True})
    ]

    CLUSTERS_KEEPER_PROMETHEUS_INSTRUMENTATION_ENABLED: bool = True

    CLUSTERS_KEEPER_REDIS: Annotated[
        RedisSettings, Field(json_schema_extra={"auto_default_from_env": True})
    ]

    CLUSTERS_KEEPER_REGISTRY: Annotated[
        RegistrySettings | None,
        Field(json_schema_extra={"auto_default_from_env": True}),
    ]

    CLUSTERS_KEEPER_TASK_INTERVAL: Annotated[
        datetime.timedelta,
        Field(
            description="interval between each clusters clean check "
            "(default to seconds, or see https://pydantic-docs.helpmanual.io/usage/types/#datetime-types for string formating)",
        ),
    ] = datetime.timedelta(seconds=30)

    SERVICE_TRACKING_HEARTBEAT: Annotated[
        datetime.timedelta,
        Field(
            description="Service heartbeat interval (everytime a heartbeat is sent into RabbitMQ) "
            "(default to seconds, or see https://pydantic-docs.helpmanual.io/usage/types/#datetime-types for string formating)",
        ),
    ] = datetime.timedelta(seconds=60)

    CLUSTERS_KEEPER_MAX_MISSED_HEARTBEATS_BEFORE_CLUSTER_TERMINATION: Annotated[
        NonNegativeInt,
        Field(
            description="Max number of missed heartbeats before a cluster is terminated",
        ),
    ] = 5

    CLUSTERS_KEEPER_COMPUTATIONAL_BACKEND_DOCKER_IMAGE_TAG: Annotated[
        str,
        Field(
            description="defines the image tag to use for the computational backend sidecar image (NOTE: it currently defaults to use itisfoundation organisation in Dockerhub)",
        ),
    ]

    CLUSTERS_KEEPER_COMPUTATIONAL_BACKEND_DEFAULT_CLUSTER_AUTH: Annotated[
        ClusterAuthentication,
        Field(
            description="defines the authentication of the clusters created via clusters-keeper (can be None or TLS)",
        ),
    ]

    CLUSTERS_KEEPER_DASK_NTHREADS: Annotated[
        NonNegativeInt,
        Field(
            description="overrides the default number of threads in the dask-sidecars, setting it to 0 will use the default (see description in dask-sidecar)",
        ),
    ]

    CLUSTERS_KEEPER_DASK_WORKER_SATURATION: Annotated[
        NonNegativeFloat | Literal["inf"],
        Field(
            description="override the dask scheduler 'worker-saturation' field"
            ", see https://selectfrom.dev/deep-dive-into-dask-distributed-scheduler-9fdb3b36b7c7",
        ),
    ] = "inf"

    CLUSTERS_KEEPER_TRACING: Annotated[
        TracingSettings | None,
        Field(
            json_schema_extra={"auto_default_from_env": True},
            description="settings for opentelemetry tracing",
        ),
    ]

    SWARM_STACK_NAME: Annotated[
        str, Field(description="Stack name defined upon deploy (see main Makefile)")
    ]

    @cached_property
    def log_level(self) -> LogLevelInt:
        return cast(LogLevelInt, self.CLUSTERS_KEEPER_LOGLEVEL)

    @field_validator("CLUSTERS_KEEPER_LOGLEVEL", mode="before")
    @classmethod
    def _valid_log_level(cls, value: str) -> str:
        return cls.validate_log_level(value)


def get_application_settings(app: FastAPI) -> ApplicationSettings:
    return cast(ApplicationSettings, app.state.settings)
