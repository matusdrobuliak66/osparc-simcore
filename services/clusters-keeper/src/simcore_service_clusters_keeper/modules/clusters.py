import datetime
import logging
from typing import cast

from aws_library.ec2.models import EC2InstanceConfig, EC2InstanceData, EC2InstanceType
from fastapi import FastAPI
from models_library.users import UserID
from models_library.wallets import WalletID
from servicelib.logging_utils import log_context
from types_aiobotocore_ec2.literals import InstanceTypeType

from ..core.errors import Ec2InstanceNotFoundError
from ..core.settings import get_application_settings
from ..utils.clusters import create_startup_script
from ..utils.ec2 import (
    HEARTBEAT_TAG_KEY,
    all_created_ec2_instances_filter,
    creation_ec2_tags,
    ec2_instances_for_user_wallet_filter,
    get_cluster_name,
)
from .ec2 import get_ec2_client

_logger = logging.getLogger(__name__)


async def create_cluster(
    app: FastAPI, *, user_id: UserID, wallet_id: WalletID | None
) -> list[EC2InstanceData]:
    ec2_client = get_ec2_client(app)
    app_settings = get_application_settings(app)
    assert app_settings.CLUSTERS_KEEPER_PRIMARY_EC2_INSTANCES  # nosec
    ec2_instance_types: list[
        EC2InstanceType
    ] = await ec2_client.get_ec2_instance_capabilities(
        instance_type_names={
            cast(
                InstanceTypeType,
                next(
                    iter(
                        app_settings.CLUSTERS_KEEPER_PRIMARY_EC2_INSTANCES.PRIMARY_EC2_INSTANCES_ALLOWED_TYPES
                    )
                ),
            )
        }
    )
    assert len(ec2_instance_types) == 1  # nosec
    instance_config = EC2InstanceConfig(
        type=ec2_instance_types[0],
        tags=creation_ec2_tags(app_settings, user_id=user_id, wallet_id=wallet_id),
        startup_script=create_startup_script(
            app_settings,
            get_cluster_name(
                app_settings, user_id=user_id, wallet_id=wallet_id, is_manager=False
            ),
        ),
        ami_id=app_settings.CLUSTERS_KEEPER_PRIMARY_EC2_INSTANCES.PRIMARY_EC2_INSTANCES_AMI_ID,
        key_name=app_settings.CLUSTERS_KEEPER_PRIMARY_EC2_INSTANCES.PRIMARY_EC2_INSTANCES_KEY_NAME,
        security_group_ids=app_settings.CLUSTERS_KEEPER_PRIMARY_EC2_INSTANCES.PRIMARY_EC2_INSTANCES_SECURITY_GROUP_IDS,
        subnet_id=app_settings.CLUSTERS_KEEPER_PRIMARY_EC2_INSTANCES.PRIMARY_EC2_INSTANCES_SUBNET_ID,
    )
    new_ec2_instance_data: list[EC2InstanceData] = await ec2_client.start_aws_instance(
        instance_config,
        number_of_instances=1,
        max_number_of_instances=app_settings.CLUSTERS_KEEPER_PRIMARY_EC2_INSTANCES.PRIMARY_EC2_INSTANCES_MAX_INSTANCES,
    )
    return new_ec2_instance_data


async def get_all_clusters(app: FastAPI) -> list[EC2InstanceData]:
    app_settings = get_application_settings(app)
    assert app_settings.CLUSTERS_KEEPER_PRIMARY_EC2_INSTANCES  # nosec
    ec2_instance_data: list[EC2InstanceData] = await get_ec2_client(app).get_instances(
        key_names=[
            app_settings.CLUSTERS_KEEPER_PRIMARY_EC2_INSTANCES.PRIMARY_EC2_INSTANCES_KEY_NAME
        ],
        tags=all_created_ec2_instances_filter(app_settings),
        state_names=["running"],
    )
    return ec2_instance_data


async def get_cluster(
    app: FastAPI, *, user_id: UserID, wallet_id: WalletID | None
) -> EC2InstanceData:
    app_settings = get_application_settings(app)
    assert app_settings.CLUSTERS_KEEPER_PRIMARY_EC2_INSTANCES  # nosec
    if instances := await get_ec2_client(app).get_instances(
        key_names=[
            app_settings.CLUSTERS_KEEPER_PRIMARY_EC2_INSTANCES.PRIMARY_EC2_INSTANCES_KEY_NAME
        ],
        tags=ec2_instances_for_user_wallet_filter(
            app_settings, user_id=user_id, wallet_id=wallet_id
        ),
    ):
        assert len(instances) == 1  # nosec
        return instances[0]
    raise Ec2InstanceNotFoundError


async def get_cluster_workers(
    app: FastAPI, *, user_id: UserID, wallet_id: WalletID | None
) -> list[EC2InstanceData]:
    app_settings = get_application_settings(app)
    assert app_settings.CLUSTERS_KEEPER_WORKERS_EC2_INSTANCES  # nosec
    ec2_instance_data: list[EC2InstanceData] = await get_ec2_client(app).get_instances(
        key_names=[
            app_settings.CLUSTERS_KEEPER_WORKERS_EC2_INSTANCES.WORKERS_EC2_INSTANCES_KEY_NAME
        ],
        tags={
            "Name": f"{get_cluster_name(app_settings, user_id=user_id, wallet_id=wallet_id, is_manager=False)}*"
        },
    )
    return ec2_instance_data


async def cluster_heartbeat(
    app: FastAPI, *, user_id: UserID, wallet_id: WalletID | None
) -> None:
    app_settings = get_application_settings(app)
    assert app_settings.CLUSTERS_KEEPER_PRIMARY_EC2_INSTANCES  # nosec
    instance = await get_cluster(app, user_id=user_id, wallet_id=wallet_id)
    await set_instance_heartbeat(app, instance=instance)


async def set_instance_heartbeat(app: FastAPI, *, instance: EC2InstanceData) -> None:
    with log_context(
        _logger, logging.DEBUG, msg=f"set instance heartbeat for {instance.id}"
    ):
        ec2_client = get_ec2_client(app)
        await ec2_client.set_instances_tags(
            [instance],
            tags={HEARTBEAT_TAG_KEY: f"{datetime.datetime.now(datetime.timezone.utc)}"},
        )


async def delete_clusters(app: FastAPI, *, instances: list[EC2InstanceData]) -> None:
    await get_ec2_client(app).terminate_instances(instances)
