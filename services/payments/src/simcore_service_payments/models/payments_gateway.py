from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Literal

from models_library.api_schemas_webserver.wallets import PaymentID, PaymentMethodID
from models_library.basic_types import AmountDecimal, IDStr
from pydantic import BaseModel, EmailStr, Extra, Field


class ErrorModel(BaseModel):
    message: str
    exception: str | None = None
    file: Path | str | None = None
    line: int | None = None
    trace: list | None = None


class UserAddress(BaseModel):
    line1: str | None = None
    state: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str


class StripeTaxExempt(str, Enum):
    exempt = "exempt"
    none = "none"  # <-- if customer is from CH or LI
    reverse = "reverse"  # <-- if customer is outside of CH or LI


class InitPayment(BaseModel):
    amount_dollars: AmountDecimal
    # metadata to store for billing or reference
    credits_: AmountDecimal = Field(
        ..., alias="credits"
    )  # NOTE: this is equal to quantity field in Stripe
    user_name: IDStr
    user_email: EmailStr
    user_address: UserAddress
    wallet_name: IDStr
    stripe_price_id: IDStr
    stripe_tax_rate_id: IDStr
    stripe_tax_exempt_value: StripeTaxExempt

    class Config:
        extra = Extra.forbid


class PaymentInitiated(BaseModel):
    payment_id: PaymentID


class PaymentCancelled(BaseModel):
    message: str | None = None


class InitPaymentMethod(BaseModel):
    method: Literal["CC"] = "CC"
    # metadata to store for billing or reference
    user_name: IDStr
    user_email: EmailStr
    wallet_name: IDStr

    class Config:
        extra = Extra.forbid


class PaymentMethodInitiated(BaseModel):
    payment_method_id: PaymentMethodID


class GetPaymentMethod(BaseModel):
    id: PaymentMethodID
    card_holder_name: str | None = None
    card_number_masked: str | None = None
    card_type: str | None = None
    expiration_month: int | None = None
    expiration_year: int | None = None
    created: datetime


class BatchGetPaymentMethods(BaseModel):
    payment_methods_ids: list[PaymentMethodID]


class PaymentMethodsBatch(BaseModel):
    items: list[GetPaymentMethod]
