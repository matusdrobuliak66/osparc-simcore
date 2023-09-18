import logging

from aiohttp import web
from models_library.api_schemas_resource_usage_tracker.credit_transactions import (
    WalletTotalCredits,
)
from models_library.api_schemas_webserver.wallets import (
    WalletGet,
    WalletGetPermissions,
    WalletGetWithAvailableCredits,
)
from models_library.products import ProductName
from models_library.users import UserID
from models_library.wallets import UserWalletDB, WalletDB, WalletID, WalletStatus

from ..resource_usage import resource_usage_tracker_client
from ..users import api as users_api
from . import _db as db
from .errors import WalletAccessForbiddenError

_logger = logging.getLogger(__name__)


async def create_wallet(
    app: web.Application,
    user_id: UserID,
    wallet_name: str,
    description: str | None,
    thumbnail: str | None,
) -> WalletGet:
    user: dict = await users_api.get_user(app, user_id)
    wallet_db: WalletDB = await db.create_wallet(
        app=app,
        owner=user["primary_gid"],
        wallet_name=wallet_name,
        description=description,
        thumbnail=thumbnail,
    )
    wallet_api: WalletGet = WalletGet(**wallet_db.dict())
    return wallet_api


async def list_wallets_with_available_credits_for_user(
    app: web.Application,
    product_name: ProductName,
    user_id: UserID,
) -> list[WalletGetWithAvailableCredits]:
    user_wallets: list[UserWalletDB] = await db.list_wallets_for_user(
        app=app, user_id=user_id
    )

    # Now we return the user wallets with available credits
    wallets_api = []
    for wallet in user_wallets:
        available_credits: WalletTotalCredits = await resource_usage_tracker_client.sum_total_available_credits_in_the_wallet(
            app, product_name, wallet.wallet_id
        )
        wallets_api.append(
            WalletGetWithAvailableCredits(
                wallet_id=wallet.wallet_id,
                name=wallet.name,
                description=wallet.description,
                owner=wallet.owner,
                thumbnail=wallet.thumbnail,
                status=wallet.status,
                created=wallet.created,
                modified=wallet.modified,
                available_credits=available_credits.available_osparc_credits,
            )
        )

    return wallets_api


async def list_wallets_for_user(
    app: web.Application,
    user_id: UserID,
) -> list[WalletGet]:
    user_wallets: list[UserWalletDB] = await db.list_wallets_for_user(
        app=app, user_id=user_id
    )
    wallets_api = [WalletGet.construct(**wallet.dict()) for wallet in user_wallets]

    return wallets_api


async def update_wallet(
    app: web.Application,
    user_id: UserID,
    wallet_id: WalletID,
    name: str,
    description: str | None,
    thumbnail: str | None,
    status: WalletStatus,
) -> WalletGet:
    wallet: UserWalletDB = await db.get_wallet_for_user(
        app=app, user_id=user_id, wallet_id=wallet_id
    )
    if wallet.write is False:
        raise WalletAccessForbiddenError(
            reason=f"Wallet {wallet_id} does not have write permission"
        )

    wallet_db: WalletDB = await db.update_wallet(
        app=app,
        wallet_id=wallet_id,
        name=name,
        description=description,
        thumbnail=thumbnail,
        status=status,
    )

    wallet_api: WalletGet = WalletGet(**wallet_db.dict())
    return wallet_api


async def delete_wallet(
    app: web.Application,
    user_id: UserID,
    wallet_id: WalletID,
) -> None:
    wallet: UserWalletDB = await db.get_wallet_for_user(
        app=app, user_id=user_id, wallet_id=wallet_id
    )
    if wallet.delete is False:
        raise WalletAccessForbiddenError(
            reason=f"Wallet {wallet_id} does not have delete permission"
        )

    raise NotImplementedError


async def get_wallet_by_user(
    app: web.Application,
    user_id: UserID,
    wallet_id: WalletID,
) -> WalletGet:
    wallet: UserWalletDB = await db.get_wallet_for_user(
        app=app, user_id=user_id, wallet_id=wallet_id
    )
    if wallet.read is False:
        raise WalletAccessForbiddenError(
            reason=f"User {user_id} does not have read permission on wallet {wallet_id}"
        )

    wallet_api: WalletGet = WalletGet(
        wallet_id=wallet.wallet_id,
        name=wallet.name,
        description=wallet.description,
        owner=wallet.owner,
        thumbnail=wallet.thumbnail,
        status=wallet.status,
        created=wallet.created,
        modified=wallet.modified,
    )
    return wallet_api


async def get_wallet_with_permissions_by_user(
    app: web.Application,
    user_id: UserID,
    wallet_id: WalletID,
) -> WalletGetPermissions:
    wallet: UserWalletDB = await db.get_wallet_for_user(
        app=app, user_id=user_id, wallet_id=wallet_id
    )

    permissions: WalletGetPermissions = WalletGetPermissions.construct(**wallet.dict())
    return permissions
