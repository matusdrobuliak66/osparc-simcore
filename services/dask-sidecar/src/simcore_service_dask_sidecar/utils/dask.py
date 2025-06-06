import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Final

import distributed
from dask_task_models_library.container_tasks.errors import TaskCancelledError
from dask_task_models_library.container_tasks.events import (
    BaseTaskEvent,
    TaskProgressEvent,
)
from dask_task_models_library.container_tasks.io import TaskCancelEventName
from dask_task_models_library.container_tasks.protocol import TaskOwner
from dask_task_models_library.models import TASK_RUNNING_PROGRESS_EVENT
from distributed.worker import get_worker
from distributed.worker_state_machine import TaskState
from models_library.progress_bar import ProgressReport
from models_library.rabbitmq_messages import LoggerRabbitMessage
from servicelib.logging_utils import LogLevelInt, LogMessageStr, log_catch, log_context

from ..rabbitmq_worker_plugin import get_rabbitmq_client

_logger = logging.getLogger(__name__)


def _get_current_task_state() -> TaskState | None:
    worker = get_worker()
    _logger.debug("current worker %s", f"{worker=}")
    current_task = worker.get_current_task()
    _logger.debug("current task %s", f"{current_task=}")
    return worker.state.tasks.get(current_task)


def is_current_task_aborted() -> bool:
    task: TaskState | None = _get_current_task_state()
    _logger.debug("found following TaskState: %s", task)
    if task is None:
        # the task was removed from the list of tasks this worker should work on, meaning it is aborted
        # NOTE: this does not work in distributed mode, hence we need to use Events, Variables,or PubSub
        _logger.debug("%s shall be aborted", f"{task=}")
        return True

    # NOTE: in distributed mode an event is necessary!
    cancel_event = distributed.Event(name=TaskCancelEventName.format(task.key))
    if cancel_event.is_set():
        _logger.debug("%s shall be aborted", f"{task=}")
        return True
    return False


_DEFAULT_MAX_RESOURCES: Final[dict[str, float]] = {"CPU": 1, "RAM": 1024**3}


def get_current_task_resources() -> dict[str, float]:
    current_task_resources = _DEFAULT_MAX_RESOURCES
    if task := _get_current_task_state():
        if task_resources := task.resource_restrictions:
            current_task_resources.update(task_resources)
    return current_task_resources


@dataclass(slots=True, kw_only=True)
class TaskPublisher:
    task_owner: TaskOwner
    _last_published_progress_value: float = -1

    def publish_progress(self, report: ProgressReport) -> None:
        rounded_value = round(report.percent_value, ndigits=2)
        if rounded_value > self._last_published_progress_value:
            with (
                log_catch(logger=_logger, reraise=False),
                log_context(
                    _logger, logging.DEBUG, msg=f"publish progress {rounded_value=}"
                ),
            ):
                publish_event(
                    TaskProgressEvent.from_dask_worker(
                        progress=rounded_value, task_owner=self.task_owner
                    ),
                )
                self._last_published_progress_value = rounded_value

    async def publish_logs(
        self,
        *,
        message: LogMessageStr,
        log_level: LogLevelInt,
    ) -> None:
        with log_catch(logger=_logger, reraise=False):
            rabbitmq_client = get_rabbitmq_client(get_worker())
            base_message = LoggerRabbitMessage.model_construct(
                user_id=self.task_owner.user_id,
                project_id=self.task_owner.project_id,
                node_id=self.task_owner.node_id,
                messages=[message],
                log_level=log_level,
            )
            await rabbitmq_client.publish_message_from_any_thread(
                base_message.channel_name, base_message
            )
            if self.task_owner.has_parent:
                assert self.task_owner.parent_project_id  # nosec
                assert self.task_owner.parent_node_id  # nosec
                parent_message = LoggerRabbitMessage.model_construct(
                    user_id=self.task_owner.user_id,
                    project_id=self.task_owner.parent_project_id,
                    node_id=self.task_owner.parent_node_id,
                    messages=[message],
                    log_level=log_level,
                )
                await rabbitmq_client.publish_message_from_any_thread(
                    parent_message.channel_name, parent_message
                )

        _logger.log(log_level, message)


_TASK_ABORTION_INTERVAL_CHECK_S: int = 2


@contextlib.asynccontextmanager
async def monitor_task_abortion(
    task_name: str, task_publishers: TaskPublisher
) -> AsyncIterator[None]:
    """This context manager periodically checks whether the client cancelled the
    monitored task. If that is the case, the monitored task will be cancelled (e.g.
    a asyncioCancelledError is raised in the task). The context manager will then
    raise a TaskCancelledError exception which will be propagated back to the client."""

    async def cancel_task(task_name: str) -> None:
        if task := next(
            (t for t in asyncio.all_tasks() if t.get_name() == task_name), None
        ):
            await task_publishers.publish_logs(
                message="[sidecar] cancelling task...", log_level=logging.INFO
            )
            task.cancel()

    async def periodicaly_check_if_aborted(task_name: str) -> None:
        while await asyncio.sleep(_TASK_ABORTION_INTERVAL_CHECK_S, result=True):
            _logger.debug("checking if %s should be cancelled", f"{task_name=}")
            if is_current_task_aborted():
                await cancel_task(task_name)

    periodically_checking_task = None
    try:
        periodically_checking_task = asyncio.create_task(
            periodicaly_check_if_aborted(task_name),
            name=f"{task_name}_monitor_task_abortion",
        )

        yield
    except asyncio.CancelledError as exc:
        await task_publishers.publish_logs(
            message="[sidecar] task run was aborted", log_level=logging.INFO
        )

        raise TaskCancelledError from exc
    finally:
        if periodically_checking_task:
            _logger.debug(
                "cancelling task cancellation checker for task '%s'",
                task_name,
            )
            periodically_checking_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await periodically_checking_task


def publish_event(
    event: BaseTaskEvent,
) -> None:
    """never reraises, only CancellationError"""
    worker = get_worker()
    _logger.debug("current worker %s", f"{worker=}")
    with (
        log_catch(_logger, reraise=False),
        log_context(_logger, logging.DEBUG, msg=f"publishing {event=}"),
    ):
        worker.log_event(
            [
                TaskProgressEvent.topic_name(),
                TASK_RUNNING_PROGRESS_EVENT.format(key=event.job_id),
            ],
            event.model_dump_json(),
        )
