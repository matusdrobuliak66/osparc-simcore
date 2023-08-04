""" Tables connected to credits
    - resource_tracker_credit_mapping table
    - resource_tracker_credit_history table
"""
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from ._common import column_created_datetime, column_modified_datetime
from .base import metadata

resource_tracker_pricing_details = sa.Table(
    "resource_tracker_pricing_details",
    metadata,
    sa.Column(
        "pricing_detail_id",
        sa.BigInteger,
        nullable=False,
        primary_key=True,
        doc="Identifier index",
    ),
    sa.Column(
        "pricing_plan_id",
        sa.BigInteger,
        sa.ForeignKey(
            "resource_tracker_pricing_plans.pricing_plan_id",
            name="fk_resource_tracker_pricing_details_pricing_plan_id",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
        nullable=False,
        doc="Foreign key to pricing plan",
        index=True,
    ),
    sa.Column(
        "unit_name",
        sa.String,
        nullable=False,
        doc="The custom name of the pricing plan, ex. DYNAMIC_SERVICES_TIERS, COMPUTATIONAL_SERVICES_TIERS, CPU_HOURS, STORAGE",
        index=True,
    ),
    sa.Column(
        "cost_per_unit",
        sa.Numeric(precision=3, scale=2),
        nullable=False,
        doc="The cost per unit of the pricing plan in credits.",
    ),
    sa.Column(
        "valid_from",
        sa.DateTime(timezone=True),
        nullable=False,
        doc="From when the pricing unit is active",
    ),
    sa.Column(
        "valid_to",
        sa.DateTime(timezone=True),
        nullable=True,
        doc="To when the pricing unit was active, if null it is still active",
    ),
    sa.Column(
        "specific_info",
        JSONB,
        nullable=False,
        server_default="{}",
        doc="Specific internal info of the pricing unit, ex. for tiers we can store in which EC2 instance type we run the service.",
    ),
    column_created_datetime(timezone=True),
    column_modified_datetime(timezone=True),
    # ---------------------------
)
