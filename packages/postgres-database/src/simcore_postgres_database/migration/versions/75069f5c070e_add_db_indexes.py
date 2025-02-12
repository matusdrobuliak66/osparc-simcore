"""add DB indexes

Revision ID: 75069f5c070e
Revises: ce4224e8b06e
Create Date: 2025-02-12 17:21:36.135085+00:00

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "75069f5c070e"
down_revision = "ce4224e8b06e"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(
        "uq_licensed_items_key_version", "licensed_items", type_="unique"
    )
    op.create_index(
        "idx_licensed_items_key_version",
        "licensed_items",
        ["key", "version"],
        unique=True,
    )
    op.create_index(
        "idx_licensed_items_checkouts_key_version",
        "resource_tracker_licensed_items_checkouts",
        ["key", "version"],
        unique=False,
    )
    op.create_index(
        "idx_licensed_items_purchases_key_version",
        "resource_tracker_licensed_items_purchases",
        ["key", "version"],
        unique=False,
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(
        "idx_licensed_items_purchases_key_version",
        table_name="resource_tracker_licensed_items_purchases",
    )
    op.drop_index(
        "idx_licensed_items_checkouts_key_version",
        table_name="resource_tracker_licensed_items_checkouts",
    )
    op.drop_index("idx_licensed_items_key_version", table_name="licensed_items")
    op.create_unique_constraint(
        "uq_licensed_items_key_version", "licensed_items", ["key", "version"]
    )
    # ### end Alembic commands ###
