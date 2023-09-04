""" Wallets credit transaction
    - Basically this table is balance sheet of each wallet.
"""
import enum

import sqlalchemy as sa

from ._common import NUMERIC_KWARGS, column_created_datetime, column_modified_datetime
from .base import metadata


class TransactionBillingStatus(str, enum.Enum):
    PENDING = "PENDING"
    BILLED = "BILLED"
    NOT_BILLED = "NOT_BILLED"
    REQUIRES_MANUAL_REVIEW = "REQUIRES_MANUAL_REVIEW"


class TransactionClassification(str, enum.Enum):
    ADD_WALLET_TOP_UP = "ADD_WALLET_TOP_UP"  # user top up credits
    DEDUCT_SERVICE_RUN = (
        "DEDUCT_SERVICE_RUN"  # computational/dynamic service run costs)
    )


resource_tracker_credit_transactions = sa.Table(
    "resource_tracker_credit_transactions",
    metadata,
    sa.Column(
        "transaction_id",
        sa.BigInteger,
        nullable=False,
        primary_key=True,
        doc="Identifier index",
    ),
    sa.Column(
        "product_name",
        sa.String,
        nullable=False,
        doc="Product name",
        index=True,
    ),
    sa.Column(
        "wallet_id",
        sa.BigInteger,
        nullable=False,
        doc="Wallet id",
        index=True,
    ),
    sa.Column(
        "wallet_name",
        sa.String,
        nullable=False,
        doc="Wallet name",
    ),
    sa.Column(
        "pricing_plan_id",
        sa.BigInteger,
        nullable=True,
        doc="Pricing plan",
    ),
    sa.Column(
        "pricing_detail_id",
        sa.BigInteger,
        nullable=True,
        doc="Pricing detail",
    ),
    sa.Column(
        "user_id",
        sa.BigInteger,
        nullable=False,
        doc="User id",
    ),
    sa.Column(
        "user_email",
        sa.String,
        nullable=False,
        doc="User email",
    ),
    sa.Column(
        "osparc_credits",
        sa.Numeric(**NUMERIC_KWARGS),
        nullable=False,
        doc="Credits",
    ),
    sa.Column(
        "transaction_status",
        sa.Enum(TransactionBillingStatus),
        nullable=True,
        doc="Transaction status, ex. PENDING, BILLED, NOT_BILLED, REQUIRES_MANUAL_REVIEW",
        index=True,
    ),
    sa.Column(
        "transaction_classification",
        sa.Enum(TransactionClassification),
        nullable=True,
        doc="Transaction classification, ex. ADD_WALLET_TOP_UP, DEDUCT_SERVICE_RUN",
        index=True,
    ),
    sa.Column(
        "service_run_id",
        sa.String,
        nullable=True,
        doc="Service run id connected with this transaction",
        index=True,
    ),
    sa.Column(
        "payment_transaction_id",
        sa.String,
        nullable=True,
        doc="Service run id connected with this transaction",
    ),
    column_created_datetime(timezone=True),
    sa.Column(
        "last_heartbeat_at",
        sa.DateTime(timezone=True),
        nullable=False,
        doc="Timestamp when was the last heartbeat",
    ),
    column_modified_datetime(timezone=True),
    # ---------------------------
)
