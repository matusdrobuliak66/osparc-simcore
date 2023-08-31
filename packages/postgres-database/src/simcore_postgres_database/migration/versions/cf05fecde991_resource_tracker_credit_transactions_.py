"""resource tracker credit transactions add columns

Revision ID: cf05fecde991
Revises: 7334e52a6afa
Create Date: 2023-08-31 14:22:49.811801+00:00

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "cf05fecde991"
down_revision = "7334e52a6afa"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "resource_tracker_credit_transactions",
        sa.Column("pricing_plan_id", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "resource_tracker_credit_transactions",
        sa.Column("pricing_detail_id", sa.BigInteger(), nullable=True),
    )
    op.drop_index(
        "ix_resource_tracker_credit_transactions_wallet_name",
        table_name="resource_tracker_credit_transactions",
    )
    op.drop_column("resource_tracker_pricing_details", "cost_per_unit")
    op.add_column(
        "resource_tracker_pricing_details",
        sa.Column("cost_per_unit", sa.NUMERIC(precision=15, scale=2), nullable=False),
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("resource_tracker_pricing_details", "cost_per_unit")
    op.add_column(
        "resource_tracker_pricing_details",
        sa.Column(
            "cost_per_unit",
            sa.NUMERIC(precision=3, scale=2),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.create_index(
        "ix_resource_tracker_credit_transactions_wallet_name",
        "resource_tracker_credit_transactions",
        ["wallet_name"],
        unique=False,
    )
    op.drop_column("resource_tracker_credit_transactions", "pricing_detail_id")
    op.drop_column("resource_tracker_credit_transactions", "pricing_plan_id")
    # ### end Alembic commands ###
