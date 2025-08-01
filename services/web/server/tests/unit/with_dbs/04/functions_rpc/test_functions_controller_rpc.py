# pylint: disable=redefined-outer-name
# pylint: disable=unused-argument

import datetime
from uuid import uuid4

import pytest
from aiohttp.test_utils import TestClient
from common_library.users_enums import UserRole
from models_library.api_schemas_webserver.functions import (
    JSONFunctionInputSchema,
    JSONFunctionOutputSchema,
    ProjectFunction,
)

# import simcore_service_webserver.functions._functions_controller_rpc as functions_rpc
from models_library.functions import FunctionUserAccessRights
from models_library.functions_errors import (
    FunctionIDNotFoundError,
    FunctionReadAccessDeniedError,
    FunctionsWriteApiAccessDeniedError,
    FunctionWriteAccessDeniedError,
)
from models_library.products import ProductName
from pytest_simcore.helpers.webserver_users import UserInfoDict
from servicelib.rabbitmq import RabbitMQRPCClient
from servicelib.rabbitmq.rpc_interfaces.webserver.functions import (
    functions_rpc_interface as functions_rpc,
)

pytest_simcore_core_services_selection = ["rabbit"]


@pytest.mark.parametrize(
    "user_role",
    [UserRole.USER],
)
async def test_register_get_delete_function(
    client: TestClient,
    add_user_function_api_access_rights: None,
    rpc_client: RabbitMQRPCClient,
    mock_function: ProjectFunction,
    logged_user: UserInfoDict,
    user_role: UserRole,
    osparc_product_name: ProductName,
    other_logged_user: UserInfoDict,
):
    # Register the function
    registered_function = await functions_rpc.register_function(
        rabbitmq_rpc_client=rpc_client,
        function=mock_function,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )
    assert registered_function.uid is not None
    assert registered_function.created_at - datetime.datetime.now(
        datetime.UTC
    ) < datetime.timedelta(seconds=60)

    # Retrieve the function from the repository to verify it was saved
    saved_function = await functions_rpc.get_function(
        rabbitmq_rpc_client=rpc_client,
        function_id=registered_function.uid,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )

    # Assert the saved function matches the input function
    assert saved_function.uid is not None
    assert saved_function.title == mock_function.title
    assert saved_function.description == mock_function.description

    # Ensure saved_function is of type ProjectFunction before accessing project_id
    assert isinstance(saved_function, ProjectFunction)
    assert saved_function.project_id == mock_function.project_id
    assert saved_function.created_at == registered_function.created_at

    # Assert the returned function matches the expected result
    assert registered_function.title == mock_function.title
    assert registered_function.description == mock_function.description
    assert isinstance(registered_function, ProjectFunction)
    assert registered_function.project_id == mock_function.project_id

    with pytest.raises(FunctionReadAccessDeniedError):
        await functions_rpc.get_function(
            rabbitmq_rpc_client=rpc_client,
            function_id=registered_function.uid,
            user_id=other_logged_user["id"],
            product_name=osparc_product_name,
        )

    with pytest.raises(FunctionWriteAccessDeniedError):
        # Attempt to delete the function by another user
        await functions_rpc.delete_function(
            rabbitmq_rpc_client=rpc_client,
            function_id=registered_function.uid,
            user_id=other_logged_user["id"],
            product_name=osparc_product_name,
        )

    with pytest.raises(FunctionsWriteApiAccessDeniedError):
        # Attempt to delete the function in another product
        await functions_rpc.delete_function(
            rabbitmq_rpc_client=rpc_client,
            function_id=registered_function.uid,
            user_id=other_logged_user["id"],
            product_name="this_is_not_osparc",
        )

    # Delete the function using its ID
    await functions_rpc.delete_function(
        rabbitmq_rpc_client=rpc_client,
        function_id=registered_function.uid,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )

    # Attempt to retrieve the deleted function
    with pytest.raises(FunctionIDNotFoundError):
        await functions_rpc.get_function(
            rabbitmq_rpc_client=rpc_client,
            function_id=registered_function.uid,
            user_id=logged_user["id"],
            product_name=osparc_product_name,
        )


@pytest.mark.parametrize(
    "user_role",
    [UserRole.USER],
)
async def test_get_function_not_found(
    client: TestClient,
    add_user_function_api_access_rights: None,
    rpc_client: RabbitMQRPCClient,
    logged_user: UserInfoDict,
    osparc_product_name: ProductName,
    clean_functions: None,
):
    # Attempt to retrieve a function that does not exist
    with pytest.raises(FunctionIDNotFoundError):
        await functions_rpc.get_function(
            rabbitmq_rpc_client=rpc_client,
            function_id=uuid4(),
            user_id=logged_user["id"],
            product_name=osparc_product_name,
        )


@pytest.mark.parametrize(
    "user_role",
    [UserRole.USER],
)
async def test_list_functions(
    client: TestClient,
    add_user_function_api_access_rights: None,
    rpc_client: RabbitMQRPCClient,
    logged_user: UserInfoDict,
    osparc_product_name: ProductName,
    clean_functions: None,
):
    # List functions when none are registered
    functions, _ = await functions_rpc.list_functions(
        rabbitmq_rpc_client=rpc_client,
        pagination_limit=10,
        pagination_offset=0,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )

    # Assert the list is empty
    assert len(functions) == 0

    # Register a function first
    mock_function = ProjectFunction(
        title="Test Function",
        description="A test function",
        input_schema=JSONFunctionInputSchema(),
        output_schema=JSONFunctionOutputSchema(),
        project_id=uuid4(),
        default_inputs=None,
    )
    registered_function = await functions_rpc.register_function(
        rabbitmq_rpc_client=rpc_client,
        function=mock_function,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )
    assert registered_function.uid is not None

    # List functions
    functions, _ = await functions_rpc.list_functions(
        rabbitmq_rpc_client=rpc_client,
        pagination_limit=10,
        pagination_offset=0,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )

    # Assert the list contains the registered function
    assert len(functions) > 0
    assert any(f.uid == registered_function.uid for f in functions)


@pytest.mark.parametrize(
    "user_role",
    [UserRole.USER],
)
async def test_list_functions_mixed_user(
    client: TestClient,
    rpc_client: RabbitMQRPCClient,
    mock_function: ProjectFunction,
    logged_user: UserInfoDict,
    osparc_product_name: ProductName,
    other_logged_user: UserInfoDict,
    add_user_function_api_access_rights: None,
):
    # Register a function for the logged user
    registered_functions = [
        await functions_rpc.register_function(
            rabbitmq_rpc_client=rpc_client,
            function=mock_function,
            user_id=logged_user["id"],
            product_name=osparc_product_name,
        )
        for _ in range(2)
    ]

    # List functions for the other logged user
    other_functions, _ = await functions_rpc.list_functions(
        rabbitmq_rpc_client=rpc_client,
        pagination_limit=10,
        pagination_offset=0,
        user_id=other_logged_user["id"],
        product_name=osparc_product_name,
    )
    # Assert the list contains only the logged user's function
    assert len(other_functions) == 0

    # Register a function for another user
    other_registered_function = [
        await functions_rpc.register_function(
            rabbitmq_rpc_client=rpc_client,
            function=mock_function,
            user_id=other_logged_user["id"],
            product_name=osparc_product_name,
        )
        for _ in range(3)
    ]

    # List functions for the logged user
    functions, _ = await functions_rpc.list_functions(
        rabbitmq_rpc_client=rpc_client,
        pagination_limit=10,
        pagination_offset=0,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )
    # Assert the list contains only the logged user's function
    assert len(functions) == 2
    assert all(f.uid in [rf.uid for rf in registered_functions] for f in functions)

    other_functions, _ = await functions_rpc.list_functions(
        rabbitmq_rpc_client=rpc_client,
        pagination_limit=10,
        pagination_offset=0,
        user_id=other_logged_user["id"],
        product_name=osparc_product_name,
    )
    # Assert the list contains only the other user's functions
    assert len(other_functions) == 3
    assert all(
        f.uid in [orf.uid for orf in other_registered_function] for f in other_functions
    )


@pytest.mark.parametrize(
    "user_role",
    [UserRole.USER],
)
async def test_list_functions_with_pagination(
    client: TestClient,
    add_user_function_api_access_rights: None,
    rpc_client: RabbitMQRPCClient,
    mock_function: ProjectFunction,
    clean_functions: None,
    osparc_product_name: ProductName,
    logged_user: UserInfoDict,
):
    # Register multiple functions
    TOTAL_FUNCTIONS = 3
    for _ in range(TOTAL_FUNCTIONS):
        await functions_rpc.register_function(
            rabbitmq_rpc_client=rpc_client,
            function=mock_function,
            user_id=logged_user["id"],
            product_name=osparc_product_name,
        )

    functions, page_info = await functions_rpc.list_functions(
        rabbitmq_rpc_client=rpc_client,
        pagination_limit=2,
        pagination_offset=0,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )

    # List functions with pagination
    functions, page_info = await functions_rpc.list_functions(
        rabbitmq_rpc_client=rpc_client,
        pagination_limit=2,
        pagination_offset=0,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )

    # Assert the list contains the correct number of functions
    assert len(functions) == 2
    assert page_info.count == 2
    assert page_info.total == TOTAL_FUNCTIONS

    # List the next page of functions
    functions, page_info = await functions_rpc.list_functions(
        rabbitmq_rpc_client=rpc_client,
        pagination_limit=2,
        pagination_offset=2,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )

    # Assert the list contains the correct number of functions
    assert len(functions) == 1
    assert page_info.count == 1
    assert page_info.total == TOTAL_FUNCTIONS


@pytest.mark.parametrize(
    "user_role",
    [UserRole.USER],
)
async def test_update_function_title(
    client: TestClient,
    rpc_client: RabbitMQRPCClient,
    mock_function: ProjectFunction,
    logged_user: UserInfoDict,
    other_logged_user: UserInfoDict,
    osparc_product_name: ProductName,
    add_user_function_api_access_rights: None,
):
    # Register the function first
    registered_function = await functions_rpc.register_function(
        rabbitmq_rpc_client=rpc_client,
        function=mock_function,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )
    assert registered_function.uid is not None

    # Update the function's title
    updated_title = "Updated Function Title"
    registered_function.title = updated_title
    updated_function = await functions_rpc.update_function_title(
        rabbitmq_rpc_client=rpc_client,
        function_id=registered_function.uid,
        title=updated_title,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )

    assert isinstance(updated_function, ProjectFunction)
    assert updated_function.uid == registered_function.uid
    # Assert the updated function's title matches the new title
    assert updated_function.title == updated_title

    # Update the function's title by other user
    updated_title = "Updated Function Title by Other User"
    registered_function.title = updated_title
    with pytest.raises(FunctionReadAccessDeniedError):
        updated_function = await functions_rpc.update_function_title(
            rabbitmq_rpc_client=rpc_client,
            function_id=registered_function.uid,
            title=updated_title,
            user_id=other_logged_user["id"],
            product_name=osparc_product_name,
        )


@pytest.mark.parametrize(
    "user_role",
    [UserRole.USER],
)
async def test_update_function_description(
    client: TestClient,
    rpc_client: RabbitMQRPCClient,
    mock_function: ProjectFunction,
    logged_user: UserInfoDict,
    osparc_product_name: ProductName,
    add_user_function_api_access_rights: None,
):
    # Register the function first
    registered_function = await functions_rpc.register_function(
        rabbitmq_rpc_client=rpc_client,
        function=mock_function,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )
    assert registered_function.uid is not None

    # Update the function's description
    updated_description = "Updated Function Description"
    registered_function.description = updated_description
    updated_function = await functions_rpc.update_function_description(
        rabbitmq_rpc_client=rpc_client,
        function_id=registered_function.uid,
        description=updated_description,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )

    assert isinstance(updated_function, ProjectFunction)
    assert updated_function.uid == registered_function.uid
    # Assert the updated function's description matches the new description
    assert updated_function.description == updated_description


@pytest.mark.parametrize(
    "user_role",
    [UserRole.USER],
)
async def test_get_function_input_schema(
    client: TestClient,
    rpc_client: RabbitMQRPCClient,
    mock_function: ProjectFunction,
    logged_user: UserInfoDict,
    osparc_product_name: ProductName,
    add_user_function_api_access_rights: None,
):
    # Register the function first
    registered_function = await functions_rpc.register_function(
        rabbitmq_rpc_client=rpc_client,
        function=mock_function,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )
    assert registered_function.uid is not None

    # Retrieve the input schema using its ID
    input_schema = await functions_rpc.get_function_input_schema(
        rabbitmq_rpc_client=rpc_client,
        function_id=registered_function.uid,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )

    # Assert the input schema matches the registered function's input schema
    assert input_schema == registered_function.input_schema


@pytest.mark.parametrize(
    "user_role",
    [UserRole.USER],
)
async def test_get_function_output_schema(
    client: TestClient,
    rpc_client: RabbitMQRPCClient,
    mock_function: ProjectFunction,
    logged_user: UserInfoDict,
    osparc_product_name: ProductName,
    add_user_function_api_access_rights: None,
):
    # Register the function first
    registered_function = await functions_rpc.register_function(
        rabbitmq_rpc_client=rpc_client,
        function=mock_function,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )
    assert registered_function.uid is not None

    # Retrieve the output schema using its ID
    output_schema = await functions_rpc.get_function_output_schema(
        rabbitmq_rpc_client=rpc_client,
        function_id=registered_function.uid,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )

    # Assert the output schema matches the registered function's output schema
    assert output_schema == registered_function.output_schema


@pytest.mark.parametrize(
    "user_role",
    [UserRole.USER],
)
async def test_delete_function(
    client: TestClient,
    rpc_client: RabbitMQRPCClient,
    mock_function: ProjectFunction,
    logged_user: UserInfoDict,
    other_logged_user: UserInfoDict,
    osparc_product_name: ProductName,
    add_user_function_api_access_rights: None,
):
    # Register the function first
    registered_function = await functions_rpc.register_function(
        rabbitmq_rpc_client=rpc_client,
        function=mock_function,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )
    assert registered_function.uid is not None


@pytest.mark.parametrize(
    "user_role",
    [UserRole.USER],
)
async def test_get_function_user_permissions(
    client: TestClient,
    add_user_function_api_access_rights: None,
    rpc_client: RabbitMQRPCClient,
    mock_function: ProjectFunction,
    logged_user: UserInfoDict,
    osparc_product_name: ProductName,
):
    # Register the function first
    registered_function = await functions_rpc.register_function(
        rabbitmq_rpc_client=rpc_client,
        function=mock_function,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )
    assert registered_function.uid is not None

    # Retrieve the user permissions for the function
    user_permissions = await functions_rpc.get_function_user_permissions(
        rabbitmq_rpc_client=rpc_client,
        function_id=registered_function.uid,
        user_id=logged_user["id"],
        product_name=osparc_product_name,
    )

    # Assert the user permissions match the expected permissions
    assert user_permissions == FunctionUserAccessRights(
        user_id=logged_user["id"],
        read=True,
        write=True,
        execute=True,
    )
