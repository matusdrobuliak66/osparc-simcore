from pathlib import Path

from models_library.api_schemas_rpc_async_jobs.async_jobs import (
    AsyncJobFilter,
    AsyncJobGet,
)
from models_library.api_schemas_storage import STORAGE_RPC_NAMESPACE
from models_library.products import ProductName
from models_library.projects_nodes_io import LocationID
from models_library.rabbitmq_basic_types import RPCMethodName
from models_library.users import UserID
from pydantic import TypeAdapter

from ..._client_rpc import RabbitMQRPCClient
from ..async_jobs.async_jobs import submit
from ._utils import get_async_job_filter


async def compute_path_size(
    client: RabbitMQRPCClient,
    *,
    user_id: UserID,
    product_name: ProductName,
    location_id: LocationID,
    path: Path,
) -> tuple[AsyncJobGet, AsyncJobFilter]:
    job_filter = get_async_job_filter(user_id=user_id, product_name=product_name)
    async_job_rpc_get = await submit(
        rabbitmq_rpc_client=client,
        rpc_namespace=STORAGE_RPC_NAMESPACE,
        method_name=TypeAdapter(RPCMethodName).validate_python("compute_path_size"),
        job_filter=job_filter,
        location_id=location_id,
        path=path,
    )
    return async_job_rpc_get, job_filter


async def delete_paths(
    client: RabbitMQRPCClient,
    *,
    user_id: UserID,
    product_name: ProductName,
    location_id: LocationID,
    paths: set[Path],
) -> tuple[AsyncJobGet, AsyncJobFilter]:
    job_filter = get_async_job_filter(user_id=user_id, product_name=product_name)
    async_job_rpc_get = await submit(
        rabbitmq_rpc_client=client,
        rpc_namespace=STORAGE_RPC_NAMESPACE,
        method_name=TypeAdapter(RPCMethodName).validate_python("delete_paths"),
        job_filter=job_filter,
        location_id=location_id,
        paths=paths,
    )
    return async_job_rpc_get, job_filter
