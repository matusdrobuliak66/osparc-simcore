"""new min_payment_amount_usd column

Revision ID: 5b37c3bc99af
Revises: 75f4afdd7a58
Create Date: 2024-03-18 13:37:48.270611+00:00

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "5b37c3bc99af"
down_revision = "75f4afdd7a58"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "products_prices",
        sa.Column(
            "min_payment_amount_usd",
            sa.Numeric(scale=2),
            server_default=sa.text("10.00"),
            nullable=False,
        ),
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("products_prices", "min_payment_amount_usd")
    # ### end Alembic commands ###