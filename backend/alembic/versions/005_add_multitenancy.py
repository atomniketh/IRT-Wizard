"""Add multi-tenancy support with users, organizations, roles, and permissions

Revision ID: 005
Revises: 004
Create Date: 2026-01-24

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SYSTEM_PERMISSIONS = [
    ("project:create", "Create Project", "project", "create"),
    ("project:read", "Read Project", "project", "read"),
    ("project:update", "Update Project", "project", "update"),
    ("project:delete", "Delete Project", "project", "delete"),
    ("project:transfer", "Transfer Project", "project", "transfer"),
    ("dataset:create", "Create Dataset", "dataset", "create"),
    ("dataset:read", "Read Dataset", "dataset", "read"),
    ("dataset:delete", "Delete Dataset", "dataset", "delete"),
    ("analysis:create", "Create Analysis", "analysis", "create"),
    ("analysis:read", "Read Analysis", "analysis", "read"),
    ("analysis:delete", "Delete Analysis", "analysis", "delete"),
    ("analysis:export", "Export Analysis", "analysis", "export"),
    ("org:read", "Read Organization", "org", "read"),
    ("org:update", "Update Organization", "org", "update"),
    ("org:delete", "Delete Organization", "org", "delete"),
    ("member:invite", "Invite Member", "member", "invite"),
    ("member:remove", "Remove Member", "member", "remove"),
    ("member:update_role", "Update Member Role", "member", "update_role"),
    ("role:create", "Create Role", "role", "create"),
    ("role:update", "Update Role", "role", "update"),
    ("role:delete", "Delete Role", "role", "delete"),
]

SYSTEM_ROLES = {
    "owner": [p[0] for p in SYSTEM_PERMISSIONS],
    "admin": [
        "project:create", "project:read", "project:update", "project:delete", "project:transfer",
        "dataset:create", "dataset:read", "dataset:delete",
        "analysis:create", "analysis:read", "analysis:delete", "analysis:export",
        "org:read", "org:update",
        "member:invite", "member:remove", "member:update_role",
    ],
    "member": [
        "project:create", "project:read", "project:update", "project:delete",
        "dataset:create", "dataset:read", "dataset:delete",
        "analysis:create", "analysis:read", "analysis:delete", "analysis:export",
        "org:read",
    ],
    "viewer": [
        "project:read",
        "dataset:read",
        "analysis:read",
        "org:read",
    ],
}


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('external_id', sa.String(255), nullable=False),
        sa.Column('auth_provider', sa.String(50), nullable=False, server_default='dev'),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('display_name', sa.String(255), nullable=True),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_superuser', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_users_external_id', 'users', ['external_id'], unique=True)
    op.create_index('idx_users_email', 'users', ['email'], unique=True)

    op.create_table(
        'organizations',
        sa.Column('id', UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('settings', JSONB(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_organizations_slug', 'organizations', ['slug'], unique=True)

    op.create_table(
        'permissions',
        sa.Column('id', UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('code', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('resource', sa.String(50), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_permissions_code', 'permissions', ['code'], unique=True)

    op.create_table(
        'roles',
        sa.Column('id', UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('organization_id', UUID(as_uuid=True), nullable=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_roles_organization', 'roles', ['organization_id'])

    op.create_table(
        'role_permissions',
        sa.Column('role_id', UUID(as_uuid=True), nullable=False),
        sa.Column('permission_id', UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('role_id', 'permission_id'),
    )

    op.create_table(
        'organization_memberships',
        sa.Column('id', UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', UUID(as_uuid=True), nullable=False),
        sa.Column('role_id', UUID(as_uuid=True), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('invited_by_id', UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['invited_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'organization_id', name='uq_user_organization'),
    )
    op.create_index('idx_memberships_user', 'organization_memberships', ['user_id'])
    op.create_index('idx_memberships_org', 'organization_memberships', ['organization_id'])

    op.add_column('projects', sa.Column('visibility', sa.String(20), nullable=False, server_default='private'))
    op.add_column('projects', sa.Column('owner_user_id', UUID(as_uuid=True), nullable=True))
    op.add_column('projects', sa.Column('owner_organization_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_projects_owner_user', 'projects', 'users', ['owner_user_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_projects_owner_org', 'projects', 'organizations', ['owner_organization_id'], ['id'], ondelete='CASCADE')
    op.create_index('idx_projects_owner_user', 'projects', ['owner_user_id'])
    op.create_index('idx_projects_owner_org', 'projects', ['owner_organization_id'])

    connection = op.get_bind()

    permission_ids = {}
    for code, name, resource, action in SYSTEM_PERMISSIONS:
        perm_id = uuid.uuid4()
        permission_ids[code] = perm_id
        connection.execute(
            sa.text(
                "INSERT INTO permissions (id, code, name, resource, action) VALUES (:id, :code, :name, :resource, :action)"
            ),
            {"id": perm_id, "code": code, "name": name, "resource": resource, "action": action}
        )

    role_ids = {}
    for role_name, perms in SYSTEM_ROLES.items():
        role_id = uuid.uuid4()
        role_ids[role_name] = role_id
        connection.execute(
            sa.text(
                "INSERT INTO roles (id, organization_id, name, is_system) VALUES (:id, NULL, :name, true)"
            ),
            {"id": role_id, "name": role_name}
        )
        for perm_code in perms:
            connection.execute(
                sa.text(
                    "INSERT INTO role_permissions (role_id, permission_id) VALUES (:role_id, :perm_id)"
                ),
                {"role_id": role_id, "perm_id": permission_ids[perm_code]}
            )

    system_user_id = uuid.uuid4()
    connection.execute(
        sa.text(
            "INSERT INTO users (id, external_id, auth_provider, email, display_name, is_active, is_superuser) "
            "VALUES (:id, :external_id, :provider, :email, :name, true, true)"
        ),
        {
            "id": system_user_id,
            "external_id": "system-migration",
            "provider": "system",
            "email": "system@local",
            "name": "System Migration User",
        }
    )

    connection.execute(
        sa.text("UPDATE projects SET owner_user_id = :user_id WHERE owner_user_id IS NULL AND owner_organization_id IS NULL"),
        {"user_id": system_user_id}
    )

    op.create_check_constraint(
        'ck_project_owner_xor',
        'projects',
        "(owner_user_id IS NOT NULL AND owner_organization_id IS NULL) OR "
        "(owner_user_id IS NULL AND owner_organization_id IS NOT NULL)"
    )


def downgrade() -> None:
    op.drop_constraint('ck_project_owner_xor', 'projects', type_='check')
    op.drop_index('idx_projects_owner_org', table_name='projects')
    op.drop_index('idx_projects_owner_user', table_name='projects')
    op.drop_constraint('fk_projects_owner_org', 'projects', type_='foreignkey')
    op.drop_constraint('fk_projects_owner_user', 'projects', type_='foreignkey')
    op.drop_column('projects', 'owner_organization_id')
    op.drop_column('projects', 'owner_user_id')
    op.drop_column('projects', 'visibility')

    op.drop_index('idx_memberships_org', table_name='organization_memberships')
    op.drop_index('idx_memberships_user', table_name='organization_memberships')
    op.drop_table('organization_memberships')
    op.drop_table('role_permissions')
    op.drop_index('idx_roles_organization', table_name='roles')
    op.drop_table('roles')
    op.drop_index('idx_permissions_code', table_name='permissions')
    op.drop_table('permissions')
    op.drop_index('idx_organizations_slug', table_name='organizations')
    op.drop_table('organizations')
    op.drop_index('idx_users_email', table_name='users')
    op.drop_index('idx_users_external_id', table_name='users')
    op.drop_table('users')
