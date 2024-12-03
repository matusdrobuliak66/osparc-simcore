"""add license db tables

Revision ID: dd0d2a5a993b
Revises: e05bdc5b3c7b
Create Date: 2024-12-03 14:55:22.308786+00:00

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "dd0d2a5a993b"
down_revision = "e05bdc5b3c7b"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "resource_tracker_license_purchases",
        sa.Column("license_purchase_id", sa.String(), nullable=False),
        sa.Column("product_name", sa.String(), nullable=False),
        sa.Column("license_package_id", sa.BigInteger(), nullable=False),
        sa.Column("wallet_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "start_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "expire_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("purchased_by_user", sa.BigInteger(), nullable=False),
        sa.Column(
            "purchased_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "modified",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("license_purchase_id"),
    )
    op.create_table(
        "resource_tracker_license_checkouts",
        sa.Column("license_checkout_id", sa.BigInteger(), nullable=False),
        sa.Column("license_package_id", sa.BigInteger(), nullable=True),
        sa.Column("wallet_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("user_email", sa.String(), nullable=True),
        sa.Column("product_name", sa.String(), nullable=False),
        sa.Column("service_run_id", sa.String(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("stopped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("num_of_seats", sa.SmallInteger(), nullable=False),
        sa.Column(
            "modified",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["service_run_id"],
            ["resource_tracker_service_runs.service_run_id"],
            name="fk_resource_tracker_license_checkouts_service_run_id",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("license_checkout_id"),
    )
    op.create_index(
        op.f("ix_resource_tracker_license_checkouts_wallet_id"),
        "resource_tracker_license_checkouts",
        ["wallet_id"],
        unique=False,
    )
    op.create_table(
        "license_packages",
        sa.Column("license_package_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "license_resource_type",
            sa.Enum("VIP_MODEL", name="licenseresourcetype"),
            nullable=False,
        ),
        sa.Column("pricing_plan_id", sa.BigInteger(), nullable=False),
        sa.Column("product_name", sa.String(), nullable=False),
        sa.Column(
            "created",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "modified",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["pricing_plan_id"],
            ["resource_tracker_pricing_plans.pricing_plan_id"],
            name="fk_resource_tracker_license_packages_pricing_plan_id",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["product_name"],
            ["products.name"],
            name="fk_resource_tracker_license_packages_product_name",
            onupdate="CASCADE",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("license_package_id"),
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table("license_packages")
    op.drop_index(
        op.f("ix_resource_tracker_license_checkouts_wallet_id"),
        table_name="resource_tracker_license_checkouts",
    )
    op.drop_table("resource_tracker_license_checkouts")
    op.drop_table("resource_tracker_license_purchases")
    # ### end Alembic commands ###
