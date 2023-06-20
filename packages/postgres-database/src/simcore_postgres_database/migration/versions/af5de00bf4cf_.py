"""new project comments table

Revision ID: af5de00bf4cf
Revises: 71ea254837b0
Create Date: 2023-06-19 08:41:09.835411+00:00

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "af5de00bf4cf"
down_revision = "71ea254837b0"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "projects_comments",
        sa.Column("comment_id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("project_uuid", sa.String(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("content", sa.String(), nullable=True),
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
            ["project_uuid"],
            ["projects.uuid"],
            name="fk_projects_comments_project_uuid",
            onupdate="CASCADE",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("comment_id", name="projects_comments_pkey"),
    )
    op.create_index(
        op.f("ix_projects_comments_project_uuid"),
        "projects_comments",
        ["project_uuid"],
        unique=False,
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(
        op.f("ix_projects_comments_project_uuid"), table_name="projects_comments"
    )
    op.drop_table("projects_comments")
    # ### end Alembic commands ###
