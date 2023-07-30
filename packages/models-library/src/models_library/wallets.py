import enum
from datetime import datetime
from typing import TypeAlias

from pydantic import BaseModel, Field, PositiveInt

from .users import GroupID

WalletID: TypeAlias = PositiveInt


class WalletStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


### DB


class WalletGetDB(BaseModel):
    wallet_id: WalletID
    name: str
    description: str | None
    owner: PositiveInt = Field(
        ...,
        description="GID of the group that owns this wallet",
    )
    thumbnail: str | None
    status: WalletStatus = Field(
        ...,
        description="Wallet status (ACTIVE or INACTIVE)",
    )
    created: datetime = Field(
        ...,
        description="Timestamp on creation",
    )
    modified: datetime = Field(
        ...,
        description="Timestamp of last modification",
    )


class UserWalletGetDB(WalletGetDB):
    read: bool
    write: bool
    delete: bool


### API


class WalletGet(BaseModel):
    wallet_id: WalletID
    name: str
    description: str | None
    owner: GroupID
    thumbnail: str | None
    status: WalletStatus
    created: datetime
    modified: datetime


class WalletGetWithAvailableCredits(WalletGet):
    available_credits: float
