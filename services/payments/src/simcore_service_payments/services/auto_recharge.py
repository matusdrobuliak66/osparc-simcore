import logging

from fastapi import FastAPI
from models_library.api_schemas_webserver.wallets import (
    GetWalletAutoRecharge,
    ReplaceWalletAutoRecharge,
)
from models_library.basic_types import NonNegativeDecimal
from models_library.products import ProductName
from models_library.users import UserID
from models_library.wallets import WalletID

# from ._methods_db import list_successful_payment_methods
# from ._onetime_api import raise_for_wallet_payments_permissions
from ..core.settings import ApplicationSettings
from ..db.auto_recharge_repo import AutoRechargeRepo, PaymentsAutorechargeDB
from ..db.payments_methods_repo import PaymentsMethodsRepo

_logger = logging.getLogger(__name__)


def _from_db_to_api_model(
    db_model: PaymentsAutorechargeDB, min_balance_in_credits: NonNegativeDecimal
) -> GetWalletAutoRecharge:
    return GetWalletAutoRecharge(
        enabled=db_model.enabled,
        payment_method_id=db_model.primary_payment_method_id,
        min_balance_in_credits=min_balance_in_credits,
        top_up_amount_in_usd=db_model.top_up_amount_in_usd,
        monthly_limit_in_usd=db_model.monthly_limit_in_usd,
    )


def _from_api_to_db_model(
    wallet_id: WalletID, api_model: ReplaceWalletAutoRecharge
) -> PaymentsAutorechargeDB:
    return PaymentsAutorechargeDB(
        wallet_id=wallet_id,
        enabled=api_model.enabled,
        primary_payment_method_id=api_model.payment_method_id,
        top_up_amount_in_usd=api_model.top_up_amount_in_usd,
        monthly_limit_in_usd=api_model.monthly_limit_in_usd,
    )


#
# payment-autorecharge api
#

_NEWEST = 0


async def get_wallet_payment_autorecharge(
    settings: ApplicationSettings,
    auto_recharge_repo: AutoRechargeRepo,
    *,
    wallet_id: WalletID,
) -> GetWalletAutoRecharge | None:
    # TODO: Permissions will be checked in webserver!
    payments_autorecharge_db: PaymentsAutorechargeDB | None = (
        await auto_recharge_repo.get_wallet_autorecharge(wallet_id=wallet_id)
    )
    if payments_autorecharge_db:
        return GetWalletAutoRecharge(
            enabled=payments_autorecharge_db.enabled,
            payment_method_id=payments_autorecharge_db.primary_payment_method_id,
            min_balance_in_credits=100.0,  # TODO: take from settings
            top_up_amount_in_usd=payments_autorecharge_db.top_up_amount_in_usd,
            monthly_limit_in_usd=payments_autorecharge_db.monthly_limit_in_usd,
        )
    return None


async def get_wallet_payment_autorecharge_with_default(
    app: FastAPI,
    auto_recharge_repo: AutoRechargeRepo,
    payments_method_repo: PaymentsMethodsRepo,
    *,
    product_name: ProductName,
    user_id: UserID,
    wallet_id: WalletID,
) -> GetWalletAutoRecharge:
    # TODO: Ask Pedro
    # await raise_for_wallet_payments_permissions(
    #     app, user_id=user_id, wallet_id=wallet_id, product_name=product_name
    # )
    wallet_autorecharge = await get_wallet_payment_autorecharge(
        app,
        auto_recharge_repo,
        wallet_id=wallet_id,
    )
    if not wallet_autorecharge:
        payment_method_id = None
        wallet_payment_methods = (
            await payments_method_repo.list_user_successful_payment_methods(
                user_id=user_id,
                wallet_id=wallet_id,
            )
        )
        if wallet_payment_methods:
            payment_method_id = wallet_payment_methods[_NEWEST].payment_method_id

        return GetWalletAutoRecharge(
            enabled=False,
            payment_method_id=payment_method_id,
            min_balance_in_credits=settings.PAYMENTS_AUTORECHARGE_MIN_BALANCE_IN_CREDITS,
            top_up_amount_in_usd=settings.PAYMENTS_AUTORECHARGE_DEFAULT_TOP_UP_AMOUNT,
            monthly_limit_in_usd=settings.PAYMENTS_AUTORECHARGE_DEFAULT_MONTHLY_LIMIT,
        )

    return wallet_autorecharge


async def replace_wallet_payment_autorecharge(
    app: FastAPI,
    repo: AutoRechargeRepo,
    *,
    product_name: ProductName,
    user_id: UserID,
    wallet_id: WalletID,
    new: ReplaceWalletAutoRecharge,
) -> GetWalletAutoRecharge:
    # TODO: Ask Pedro
    # await raise_for_wallet_payments_permissions(
    #     app, user_id=user_id, wallet_id=wallet_id, product_name=product_name
    # )
    settings: ApplicationSettings = app.state.settings
    got: PaymentsAutorechargeDB = await repo.replace_wallet_autorecharge(
        user_id=user_id,
        wallet_id=wallet_id,
        new=_from_api_to_db_model(wallet_id, new),
    )

    return _from_db_to_api_model(
        got,
        min_balance_in_credits=settings.PAYMENTS_AUTORECHARGE_MIN_BALANCE_IN_CREDITS,
    )
