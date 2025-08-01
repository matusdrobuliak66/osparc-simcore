from typing import Annotated, Any, TypeAlias

from models_library.computations import CollectionRunID
from pydantic import (
    AnyHttpUrl,
    AnyUrl,
    BaseModel,
    ConfigDict,
    Field,
    ValidationInfo,
    field_validator,
)

from ..basic_types import IDStr
from ..projects import ProjectID
from ..projects_nodes_io import NodeID, SimcoreS3FileID
from ..projects_pipeline import ComputationTask
from ..users import UserID
from ..wallets import WalletInfo


class ComputationGet(ComputationTask):
    url: Annotated[
        AnyHttpUrl, Field(description="the link where to get the status of the task")
    ]
    stop_url: Annotated[
        AnyHttpUrl | None, Field(description="the link where to stop the task")
    ] = None

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                x | {"url": "https://url.local"}
                for x in ComputationTask.model_json_schema()["examples"]
            ]
        }
    )


class ComputationCreate(BaseModel):
    user_id: UserID
    project_id: ProjectID
    start_pipeline: Annotated[
        bool | None,
        Field(description="if True the computation pipeline will start right away"),
    ] = False
    product_name: Annotated[str, Field()]
    product_api_base_url: Annotated[
        AnyHttpUrl,
        Field(description="Base url of the product"),
    ]
    subgraph: Annotated[
        list[NodeID] | None,
        Field(
            description="An optional set of nodes that must be executed, if empty the whole pipeline is executed"
        ),
    ] = None
    force_restart: Annotated[
        bool | None,
        Field(description="if True will force re-running all dependent nodes"),
    ] = False
    simcore_user_agent: str = ""
    use_on_demand_clusters: Annotated[
        bool,
        Field(
            description="if True, a cluster will be created as necessary (wallet_id cannot be None)",
            validate_default=True,
        ),
    ] = False
    wallet_info: Annotated[
        WalletInfo | None,
        Field(
            description="contains information about the wallet used to bill the running service"
        ),
    ] = None
    collection_run_id: Annotated[
        CollectionRunID | None,
        Field(
            description="In case start_pipeline is True, this is the collection run id to which the comp run belongs."
        ),
    ] = None

    @field_validator("product_name")
    @classmethod
    def _ensure_product_name_defined_if_computation_starts(
        cls, v, info: ValidationInfo
    ):
        if info.data.get("start_pipeline") and v is None:
            msg = "product_name must be set if computation shall start!"
            raise ValueError(msg)
        return v

    @field_validator("collection_run_id")
    @classmethod
    def _ensure_collection_run_id_dependency_on_start_pipeline(
        cls, v, info: ValidationInfo
    ):
        start_pipeline = info.data.get("start_pipeline")
        if start_pipeline and v is None:
            msg = "collection_run_id must be provided when start_pipeline is True!"
            raise ValueError(msg)
        if not start_pipeline and v is not None:
            msg = "collection_run_id must be None when start_pipeline is False!"
            raise ValueError(msg)
        return v


class ComputationStop(BaseModel):
    user_id: UserID


class ComputationDelete(ComputationStop):
    force: Annotated[
        bool | None,
        Field(
            description="if True then the pipeline will be removed even if it is running"
        ),
    ] = False


class TaskLogFileGet(BaseModel):
    task_id: NodeID
    download_link: Annotated[
        AnyUrl | None,
        Field(description="Presigned link for log file or None if still not available"),
    ] = None


class TaskLogFileIdGet(BaseModel):
    task_id: NodeID
    file_id: SimcoreS3FileID | None

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "task_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "file_id": "1c46752c-b096-11ea-a3c4-02420a00392e/3fa85f64-5717-4562-b3fc-2c963f66afa6/logs/task_logs.txt",
                },
                {
                    "task_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
                    "file_id": "1c46752c-b096-11ea-a3c4-02420a00392e/6ba7b810-9dad-11d1-80b4-00c04fd430c8/logs/debug.log",
                },
                {
                    "task_id": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
                    "file_id": None,
                },
            ]
        }
    )


class TasksSelection(BaseModel):
    nodes_ids: list[NodeID]


OutputName: TypeAlias = IDStr


class TasksOutputs(BaseModel):
    nodes_outputs: dict[NodeID, dict[OutputName, Any]]
