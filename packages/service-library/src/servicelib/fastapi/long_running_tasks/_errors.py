from pydantic.errors import PydanticErrorMixin


class BaseLongRunningError(PydanticErrorMixin, Exception):
    """base exception for this module"""


class TaskAlreadyRunningError(BaseLongRunningError):
    code: str = "fastapi.long_running.task_already_running"
    msg_template: str = "{task_name} must be unique, found: '{managed_task}"


class TaskNotFoundError(BaseLongRunningError):
    code: str = "fastapi.long_running.task_not_found"
    msg_template: str = "No task with {task_id} found"


class TaskNotCompletedError(BaseLongRunningError):
    code: str = "fastapi.long_running.task_not_completed"
    msg_template: str = "Task {task_id} has not finished yet"


class TaskCancelledError(BaseLongRunningError):
    code: str = "fastapi.long_running.task_cancelled_error"
    msg_template: str = "Task {task_id} was cancelled before completing"


class TaskExceptionError(BaseLongRunningError):
    code: str = "fastapi.long_running.task_exception_error"
    msg_template: str = (
        "Task {task_id} finished with exception: '{exception}'\n{traceback}"
    )


class TaskClientTimeoutError(BaseLongRunningError):
    code: str = "fastapi.client.timed_out_waiting_for_response"
    msg_template: str = (
        "Timed out after {timeout} seconds while awaiting '{task_id}' to complete"
    )


class GenericClientError(BaseLongRunningError):
    code: str = "fastapi.client.generic_error"
    msg_template: str = (
        "Unexpected error while '{action}' for '{task_id}': status={status} body={body}"
    )


class TaskClientResultError(BaseLongRunningError):
    code: str = "fastapi.client.task_raised_error"
    msg_template: str = "{message}"
