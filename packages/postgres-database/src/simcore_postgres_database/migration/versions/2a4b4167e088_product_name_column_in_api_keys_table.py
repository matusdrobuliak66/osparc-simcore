"""product_name column in api_keys table

Revision ID: 2a4b4167e088
Revises: be0dece4e67c
Create Date: 2023-10-26 06:53:52.079499+00:00

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "2a4b4167e088"
down_revision = "be0dece4e67c"
branch_labels = None
depends_on = None


def _find_default_product_name_or_none(conn):
    query = sa.text("SELECT name FROM products ORDER BY priority LIMIT 1")
    result = conn.execute(query)
    row = result.fetchone()
    return row[0] if row else None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column("api_keys", sa.Column("product_name", sa.String(), nullable=True))
    op.create_foreign_key(
        "fk_api_keys_product_name",
        "api_keys",
        "products",
        ["product_name"],
        ["name"],
        onupdate="CASCADE",
        ondelete="CASCADE",
    )
    # ### end Alembic commands ###

    conn = op.get_bind()
    default_product = _find_default_product_name_or_none(conn)
    if default_product:
        op.execute(sa.DDL(f"UPDATE api_keys SET product_name = '{default_product}'"))

    # make it non nullable now
    op.alter_column(
        "api_keys", "product_name", existing_type=sa.String(), nullable=False
    )


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint("fk_api_keys_product_name", "api_keys", type_="foreignkey")
    op.drop_column("api_keys", "product_name")
    # ### end Alembic commands ###