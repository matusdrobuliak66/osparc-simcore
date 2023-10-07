"""refactor pricing units table

Revision ID: f613247f5bb1
Revises: b102946c8134
Create Date: 2023-10-07 15:13:38.557368+00:00

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "f613247f5bb1"
down_revision = "b102946c8134"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("resource_tracker_pricing_unit_costs", "specific_info")
    op.add_column(
        "resource_tracker_pricing_units",
        sa.Column(
            "unit_attributes", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("resource_tracker_pricing_units", "unit_attributes")
    op.add_column(
        "resource_tracker_pricing_unit_costs",
        sa.Column(
            "specific_info",
            postgresql.JSONB(astext_type=sa.Text()),
            autoincrement=False,
            nullable=False,
        ),
    )
    # ### end Alembic commands ###
