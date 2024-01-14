""" Helper script to automatically generate OAS

This OAS are the source of truth
"""

# pylint: disable=redefined-outer-name
# pylint: disable=unused-argument
# pylint: disable=unused-variable
# pylint: disable=too-many-arguments


from _common import assert_handler_signature_against_model
from fastapi import APIRouter, Query
from models_library.api_schemas_webserver.resource_usage import (
    PricingUnitGet,
    ServiceRunGet,
)
from models_library.generics import Envelope
from models_library.resource_tracker import PricingPlanId, PricingUnitId
from models_library.rest_pagination import DEFAULT_NUMBER_OF_ITEMS_PER_PAGE
from models_library.wallets import WalletID
from pydantic import Json, NonNegativeInt
from simcore_service_webserver._meta import API_VTAG
from simcore_service_webserver.resource_usage._pricing_plans_handlers import (
    _GetPricingPlanUnitPathParams,
)
from simcore_service_webserver.resource_usage._service_runs_handlers import (
    _ListServicesResourceUsagesQueryParams,
)

router = APIRouter(prefix=f"/{API_VTAG}")


#
# API entrypoints
#


@router.get(
    "/services/-/resource-usages",
    response_model=Envelope[list[ServiceRunGet]],
    summary="Retrieve finished and currently running user services (user and product are taken from context, optionally wallet_id parameter might be provided).",
    tags=["usage"],
)
async def list_resource_usage_services(
    order_by: Json = Query(
        None,
        description="Order by field (started_at|stopped_at|credit_cost) and direction (asc|desc). The default sorting order is ascending.",
        example='{"field": "started_at", "direction": "desc"}',
    ),
    filters: Json = Query(
        None,
        description="Filters to process on the resource usages list, encoded as JSON. Currently supports the filtering of 'started_at' field with 'from' and 'until' parameters in <yyyy-mm-dd> UTC format. The date range specidied is inclusive.",
        example='{"started_at": {"from": "yyyy-mm-dd", "until": "yyyy-mm-dd"}}',
    ),
    wallet_id: WalletID = Query(None),
    limit: int = DEFAULT_NUMBER_OF_ITEMS_PER_PAGE,
    offset: NonNegativeInt = 0,
):
    ...


assert_handler_signature_against_model(
    list_resource_usage_services, _ListServicesResourceUsagesQueryParams
)


@router.get(
    "/pricing-plans/{pricing_plan_id}/pricing-units/{pricing_unit_id}",
    response_model=Envelope[PricingUnitGet],
    summary="Retrieve detail information about pricing unit",
    tags=["pricing-plans"],
)
async def get_pricing_plan_unit(
    pricing_plan_id: PricingPlanId, pricing_unit_id: PricingUnitId
):
    ...


assert_handler_signature_against_model(
    get_pricing_plan_unit, _GetPricingPlanUnitPathParams
)
