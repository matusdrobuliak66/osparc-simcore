"""Added column to file_meta_data

Revision ID: 99db5efc4548
Revises: 645807399320
Create Date: 2019-06-21 13:22:23.214635+00:00

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "99db5efc4548"
down_revision = "645807399320"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column("file_meta_data", sa.Column("created_at", sa.String(), nullable=True))
    op.add_column(
        "file_meta_data", sa.Column("display_file_path", sa.String(), nullable=True)
    )
    op.add_column("file_meta_data", sa.Column("file_id", sa.String(), nullable=True))
    op.add_column("file_meta_data", sa.Column("file_size", sa.Integer(), nullable=True))
    op.add_column(
        "file_meta_data", sa.Column("last_modified", sa.String(), nullable=True)
    )
    op.add_column(
        "file_meta_data", sa.Column("raw_file_path", sa.String(), nullable=True)
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("file_meta_data", "raw_file_path")
    op.drop_column("file_meta_data", "last_modified")
    op.drop_column("file_meta_data", "file_size")
    op.drop_column("file_meta_data", "file_id")
    op.drop_column("file_meta_data", "display_file_path")
    op.drop_column("file_meta_data", "created_at")
    # ### end Alembic commands ###
