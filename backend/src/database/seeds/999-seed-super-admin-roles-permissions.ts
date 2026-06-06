import { createPublicKey } from 'crypto';
import argon2 from 'argon2';
import { DataSource, QueryRunner } from 'typeorm';

const basePermissions = [
  ['users.create', 'users', 'create'],
  ['users.read', 'users', 'read'],
  ['users.update', 'users', 'update'],
  ['users.delete', 'users', 'delete'],
  ['users.lock', 'users', 'lock'],
  ['users.unlock', 'users', 'unlock'],
  ['tenants.create', 'tenants', 'create'],
  ['tenants.read', 'tenants', 'read'],
  ['tenants.update', 'tenants', 'update'],
  ['tenants.suspend', 'tenants', 'suspend'],
  ['organizations.create', 'organizations', 'create'],
  ['organizations.read', 'organizations', 'read'],
  ['organizations.update', 'organizations', 'update'],
  ['organizations.delete', 'organizations', 'delete'],
  ['teams.create', 'teams', 'create'],
  ['teams.read', 'teams', 'read'],
  ['teams.update', 'teams', 'update'],
  ['teams.delete', 'teams', 'delete'],
  ['memberships.create', 'memberships', 'create'],
  ['memberships.read', 'memberships', 'read'],
  ['memberships.update', 'memberships', 'update'],
  ['memberships.delete', 'memberships', 'delete'],
  ['roles.create', 'roles', 'create'],
  ['roles.read', 'roles', 'read'],
  ['roles.update', 'roles', 'update'],
  ['roles.delete', 'roles', 'delete'],
  ['roles.assign', 'roles', 'assign'],
  ['permissions.read', 'permissions', 'read'],
  ['permissions.assign', 'permissions', 'assign'],
  ['sessions.read', 'sessions', 'read'],
  ['sessions.revoke', 'sessions', 'revoke'],
  ['sso_clients.create', 'sso_clients', 'create'],
  ['sso_clients.read', 'sso_clients', 'read'],
  ['sso_clients.update', 'sso_clients', 'update'],
  ['sso_clients.delete', 'sso_clients', 'delete'],
  ['api_keys.create', 'api_keys', 'create'],
  ['api_keys.read', 'api_keys', 'read'],
  ['api_keys.revoke', 'api_keys', 'revoke'],
  ['audit_logs.read', 'audit_logs', 'read'],
];

const baseRoles = [
  ['SUPER_ADMIN', 'Super admin', 'Global platform administrator'],
  ['HEMIA_ADMIN', 'Hemia admin', 'Hemia internal administrator'],
  ['TENANT_OWNER', 'Tenant owner', 'Tenant owner'],
  ['TENANT_ADMIN', 'Tenant admin', 'Tenant administrator'],
  ['TEAM_OWNER', 'Team owner', 'Team owner'],
  ['MEMBER', 'Member', 'Standard member'],
  ['VIEWER', 'Viewer', 'Read-only member'],
  ['SERVICE_ACCOUNT', 'Service account', 'Machine-to-machine account'],
];

export async function seed999SuperAdminRolesPermissions(
  dataSource: DataSource,
) {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await seedPermissions(queryRunner);
    await seedRoles(queryRunner);
    await seedRolePermissions(queryRunner);
    await seedSuperAdmin(queryRunner);
    await seedJwksKey(queryRunner);
    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

async function seedPermissions(queryRunner: QueryRunner) {
  for (const [code, resource, action] of basePermissions) {
    await queryRunner.query(
      `INSERT INTO "permissions" ("code", "resource", "action") VALUES ($1, $2, $3) ON CONFLICT ("code") DO NOTHING`,
      [code, resource, action],
    );
  }
}

async function seedRoles(queryRunner: QueryRunner) {
  for (const [code, name, description] of baseRoles) {
    await queryRunner.query(
      `INSERT INTO "roles" ("code", "name", "description", "is_system") VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING`,
      [code, name, description],
    );
  }
}

async function seedRolePermissions(queryRunner: QueryRunner) {
  await queryRunner.query(`
    INSERT INTO "role_permissions" ("role_id", "permission_id")
    SELECT role.id, permission.id
    FROM "roles" role
    CROSS JOIN "permissions" permission
    WHERE role.code = 'SUPER_ADMIN'
    ON CONFLICT ("role_id", "permission_id") DO NOTHING
  `);

  await queryRunner.query(`
    INSERT INTO "role_permissions" ("role_id", "permission_id")
    SELECT role.id, permission.id
    FROM "roles" role
    JOIN "permissions" permission ON permission.action = 'read'
    WHERE role.code IN ('VIEWER', 'MEMBER')
    ON CONFLICT ("role_id", "permission_id") DO NOTHING
  `);
}

async function seedSuperAdmin(queryRunner: QueryRunner) {
  const email = process.env.SUPER_ADMIN_EMAIL ?? 'admin@hemia.cloud';
  const username = process.env.SUPER_ADMIN_USERNAME ?? 'superadmin';
  const firstName = process.env.SUPER_ADMIN_FIRST_NAME ?? 'Hemia';
  const lastName = process.env.SUPER_ADMIN_LAST_NAME ?? 'Admin';
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!password) {
    throw new Error(
      'SUPER_ADMIN_PASSWORD is required to seed the super admin user',
    );
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const users = await queryRunner.query(
    `
      INSERT INTO "users" (
        "email",
        "username",
        "password_hash",
        "first_name",
        "last_name",
        "status"
      )
      VALUES ($1, $2, $3, $4, $5, 'active')
      ON CONFLICT ("email") WHERE "deleted_at" IS NULL DO UPDATE
      SET
        "username" = EXCLUDED."username",
        "password_hash" = EXCLUDED."password_hash",
        "first_name" = EXCLUDED."first_name",
        "last_name" = EXCLUDED."last_name",
        "status" = 'active',
        "updated_at" = now()
      RETURNING "id"
    `,
    [
      email.toLowerCase(),
      username.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
    ],
  );

  const userId = users[0]?.id as string | undefined;
  if (!userId) {
    throw new Error('Could not create super admin user');
  }

  await queryRunner.query(
    `
      INSERT INTO "user_roles" ("user_id", "role_id")
      SELECT $1, role.id
      FROM "roles" role
      WHERE role.code = 'SUPER_ADMIN'
        AND NOT EXISTS (
          SELECT 1
          FROM "user_roles" user_role
          WHERE user_role.user_id = $1
            AND user_role.role_id = role.id
            AND user_role.tenant_id IS NULL
            AND user_role.organization_id IS NULL
            AND user_role.team_id IS NULL
        )
    `,
    [userId],
  );
}

async function seedJwksKey(queryRunner: QueryRunner) {
  const activeKeys = await queryRunner.query(
    `SELECT "id" FROM "jwks_keys" WHERE "status" = 'active' LIMIT 1`,
  );

  if (activeKeys.length > 0) {
    return;
  }

  const kid = process.env.JWKS_KEY_KID ?? 'local-dev-rs256';
  const privateKey = getJwksPrivateKey();
  const publicKey = createPublicKey(privateKey)
    .export({ type: 'spki', format: 'pem' })
    .toString();

  await queryRunner.query(
    `
      INSERT INTO "jwks_keys" (
        "kid",
        "alg",
        "public_key",
        "private_key_encrypted",
        "status"
      )
      VALUES ($1, 'RS256', $2, $3, 'active')
      ON CONFLICT ("kid") DO UPDATE
      SET
        "alg" = EXCLUDED."alg",
        "public_key" = EXCLUDED."public_key",
        "private_key_encrypted" = EXCLUDED."private_key_encrypted",
        "status" = 'active',
        "rotated_at" = NULL
    `,
    [kid, publicKey, privateKey],
  );
}

function getJwksPrivateKey() {
  if (process.env.JWKS_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.JWKS_PRIVATE_KEY_BASE64, 'base64').toString(
      'utf8',
    );
  }

  if (process.env.JWKS_PRIVATE_KEY) {
    return process.env.JWKS_PRIVATE_KEY.replace(/\\n/g, '\n');
  }

  throw new Error(
    'JWKS_PRIVATE_KEY_BASE64 or JWKS_PRIVATE_KEY is required to seed the active JWKS key',
  );
}
