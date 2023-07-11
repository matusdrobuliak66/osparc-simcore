"""refactoring of resource_tracker_container table

Revision ID: cd53975abda2
Revises: f3285aff5e84
Create Date: 2023-07-10 17:15:34.126749+00:00

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "cd53975abda2"
down_revision = "f3285aff5e84"
branch_labels = None
depends_on = None


def upgrade():
    type = postgresql.ENUM("DYNAMIC_SIDECAR", "USER_SERVICE", name="containertype")
    type.create(op.get_bind())

    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "resource_tracker_container",
        sa.Column("cpu_limit", sa.Numeric(precision=3, scale=2), nullable=False),
    )
    op.add_column(
        "resource_tracker_container",
        sa.Column("memory_limit", sa.BigInteger(), nullable=False),
    )
    op.add_column(
        "resource_tracker_container",
        sa.Column(
            "type",
            sa.Enum("DYNAMIC_SIDECAR", "USER_SERVICE", name="containertype"),
            nullable=True,
        ),
    )
    op.drop_column(
        "resource_tracker_container", "service_settings_reservation_nano_cpus"
    )
    op.drop_column("resource_tracker_container", "service_settings_limit_memory_bytes")
    op.drop_column(
        "resource_tracker_container", "service_settings_reservation_memory_bytes"
    )
    op.drop_column("resource_tracker_container", "service_settings_limit_nano_cpus")
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "resource_tracker_container",
        sa.Column(
            "service_settings_limit_nano_cpus",
            sa.BIGINT(),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "resource_tracker_container",
        sa.Column(
            "service_settings_reservation_memory_bytes",
            sa.BIGINT(),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "resource_tracker_container",
        sa.Column(
            "service_settings_limit_memory_bytes",
            sa.BIGINT(),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "resource_tracker_container",
        sa.Column(
            "service_settings_reservation_nano_cpus",
            sa.BIGINT(),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.drop_column("resource_tracker_container", "type")
    op.drop_column("resource_tracker_container", "memory_limit")
    op.drop_column("resource_tracker_container", "cpu_limit")
    # ### end Alembic commands ###
