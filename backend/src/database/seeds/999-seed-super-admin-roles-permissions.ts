import { createPublicKey } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
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
  ['docs.access', 'docs', 'access'],
  ['docs.*', 'docs', '*'],
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
  ['DOCS_ADMIN', 'Docs admin', 'Hemia Docs administrator'],
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
    await seedLocalUser(queryRunner);
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

  await queryRunner.query(`
    INSERT INTO "role_permissions" ("role_id", "permission_id")
    SELECT role.id, permission.id
    FROM "roles" role
    JOIN "permissions" permission ON permission.code IN (
      'docs.access',
      'docs.*'
    )
    WHERE role.code = 'DOCS_ADMIN'
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

async function seedLocalUser(queryRunner: QueryRunner) {
  const tenantId = await seedTenant(queryRunner);
  const organizationId = await seedOrganization(queryRunner, tenantId);
  const teamId = await seedTeam(queryRunner, tenantId, organizationId);

  await seedOAuthClient(queryRunner);
  await seedUser(queryRunner, {
    email: process.env.SEED_USER_EMAIL ?? 'admin@hemia.local',
    username: process.env.SEED_USER_USERNAME ?? 'admin',
    firstName: process.env.SEED_USER_FIRST_NAME ?? 'Admin',
    lastName: process.env.SEED_USER_LAST_NAME ?? 'User',
    password: process.env.SEED_USER_PASSWORD ?? getLocalSeedPassword(),
    roleCode: 'DOCS_ADMIN',
    tenantId,
    organizationId,
    teamId,
  });
}

async function seedTenant(queryRunner: QueryRunner) {
  const tenants = await queryRunner.query(
    `
      INSERT INTO "tenants" ("name", "slug", "status", "plan")
      VALUES ('Hemia Local', 'hemia-local', 'active', 'local')
      ON CONFLICT ("slug") WHERE "deleted_at" IS NULL DO UPDATE
      SET
        "name" = EXCLUDED."name",
        "status" = 'active',
        "plan" = EXCLUDED."plan",
        "updated_at" = now()
      RETURNING "id"
    `,
  );

  return tenants[0].id as string;
}

async function seedOrganization(queryRunner: QueryRunner, tenantId: string) {
  const organizations = await queryRunner.query(
    `
      INSERT INTO "organizations" ("tenant_id", "name", "slug")
      VALUES ($1, 'Hemia', 'hemia')
      ON CONFLICT ("tenant_id", "slug") WHERE "deleted_at" IS NULL DO UPDATE
      SET
        "name" = EXCLUDED."name",
        "updated_at" = now()
      RETURNING "id"
    `,
    [tenantId],
  );

  return organizations[0].id as string;
}

async function seedTeam(
  queryRunner: QueryRunner,
  tenantId: string,
  organizationId: string,
) {
  const seedTeams = [
    {
      name: 'Producto e Ingeniería',
      slug: 'producto-ingenieria',
      description: 'Producto, ingeniería y entrega técnica',
    },
    {
      name: 'Calidad y Soporte',
      slug: 'calidad-soporte',
      description: 'Aseguramiento de calidad y soporte operativo',
    },
    {
      name: 'Comercial y de Crecimiento',
      slug: 'comercial-crecimiento',
      description: 'Ventas, crecimiento e ingresos',
    },
  ];

  await queryRunner.query(
    `
      UPDATE "teams"
      SET
        "deleted_at" = now(),
        "updated_at" = now()
      WHERE "tenant_id" = $1
        AND "organization_id" = $2
        AND "slug" = $3
        AND "deleted_at" IS NULL
    `,
    [tenantId, organizationId, 'docs'],
  );

  const teams = await queryRunner.query(
    `
      WITH seed_teams ("name", "slug", "description") AS (
        SELECT "name", "slug", "description"
        FROM jsonb_to_recordset($3::jsonb) AS team(
          "name" text,
          "slug" text,
          "description" text
        )
      ),
      upserted_teams AS (
        INSERT INTO "teams" (
          "tenant_id",
          "organization_id",
          "name",
          "slug",
          "description"
        )
        SELECT $1, $2, "name", "slug", "description"
        FROM seed_teams
        ON CONFLICT ("tenant_id", "organization_id", "slug")
          WHERE "deleted_at" IS NULL
        DO UPDATE
        SET
          "name" = EXCLUDED."name",
          "description" = EXCLUDED."description",
          "updated_at" = now()
        RETURNING "id", "slug"
      )
      SELECT "id"
      FROM upserted_teams
      WHERE "slug" = $4
    `,
    [tenantId, organizationId, JSON.stringify(seedTeams), seedTeams[0].slug],
  );

  return teams[0].id as string;
}

async function seedOAuthClient(queryRunner: QueryRunner) {
  const clientSecret = 'dummy_identity_service_client_secret';
  const clientSecretHash = await argon2.hash(clientSecret, {
    type: argon2.argon2id,
  });

  await queryRunner.query(
    `
      INSERT INTO "oauth_clients" (
        "client_id",
        "audience",
        "client_secret_hash",
        "type",
        "redirect_uris",
        "grant_types",
        "response_types",
        "scopes",
        "requires_consent",
        "status"
      )
      VALUES (
        'hemia-docs',
        'hemia-docs-api',
        $1,
        'confidential',
        ARRAY['http://localhost:3001/auth/callback'],
        ARRAY['authorization_code', 'refresh_token', 'client_credentials'],
        ARRAY['code'],
        ARRAY[
          'openid',
          'profile',
          'email',
          'offline_access',
          'docs.access',
          'docs.*',
          'identity.users.read',
          'identity.memberships.read',
          'identity.teams.read',
          'identity.invitations.write',
          'identity.events.read'
        ],
        false,
        'active'
      )
      ON CONFLICT ("client_id") WHERE "deleted_at" IS NULL DO UPDATE
      SET
        "type" = EXCLUDED."type",
        "audience" = EXCLUDED."audience",
        "client_secret_hash" = EXCLUDED."client_secret_hash",
        "redirect_uris" = EXCLUDED."redirect_uris",
        "grant_types" = EXCLUDED."grant_types",
        "response_types" = EXCLUDED."response_types",
        "scopes" = EXCLUDED."scopes",
        "requires_consent" = false,
        "status" = 'active',
        "updated_at" = now()
    `,
    [clientSecretHash],
  );
}

async function seedUser(
  queryRunner: QueryRunner,
  input: {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    password: string;
    roleCode: string;
    tenantId: string;
    organizationId: string;
    teamId: string;
  },
) {
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
  });
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
      input.email.toLowerCase(),
      input.username.toLowerCase(),
      passwordHash,
      input.firstName,
      input.lastName,
    ],
  );
  const userId = users[0]?.id as string | undefined;
  if (!userId) {
    throw new Error(`Could not create ${input.email}`);
  }

  await queryRunner.query(
    `
      INSERT INTO "memberships" (
        "user_id",
        "tenant_id",
        "organization_id",
        "team_id",
        "status"
      )
      VALUES ($1, $2, $3, $4, 'active')
      ON CONFLICT ("user_id", "tenant_id", "organization_id", "team_id")
        WHERE "deleted_at" IS NULL
      DO UPDATE
      SET
        "status" = 'active',
        "updated_at" = now()
    `,
    [userId, input.tenantId, input.organizationId, input.teamId],
  );

  await queryRunner.query(
    `
      INSERT INTO "user_roles" (
        "user_id",
        "role_id",
        "tenant_id",
        "organization_id",
        "team_id",
        "system_id"
      )
      SELECT $1, role.id, $2, $3, $4, 'hemia-docs'
      FROM "roles" role
      WHERE role.code = $5
        AND NOT EXISTS (
          SELECT 1
          FROM "user_roles" user_role
          WHERE user_role.user_id = $1
            AND user_role.role_id = role.id
            AND user_role.tenant_id = $2
            AND user_role.organization_id = $3
            AND user_role.team_id = $4
            AND user_role.system_id = 'hemia-docs'
        )
    `,
    [
      userId,
      input.tenantId,
      input.organizationId,
      input.teamId,
      input.roleCode,
    ],
  );
}

function getLocalSeedPassword() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SEED_USER_PASSWORD is required in production');
  }

  return 'Admin123!';
}

async function seedJwksKey(queryRunner: QueryRunner) {
  const kid = process.env.JWKS_KEY_KID ?? 'local-dev-rs256';
  const privateKey = getJwksPrivateKey();
  const publicKey = createPublicKey(privateKey)
    .export({ type: 'spki', format: 'pem' })
    .toString();
  const activeKeys = await queryRunner.query(
    `SELECT "id", "kid", "private_key_encrypted" FROM "jwks_keys" WHERE "status" = 'active' LIMIT 1`,
  );

  if (activeKeys.length > 0) {
    const [activeKey] = activeKeys;
    if (
      activeKey.kid === kid &&
      activeKey.private_key_encrypted === privateKey
    ) {
      return;
    }

    if (activeKey.kid === kid) {
      throw new Error(
        `Active JWKS key ${kid} uses different private key material. Change JWKS_KEY_KID before rotating keys.`,
      );
    }

    await queryRunner.query(
      `
        UPDATE "jwks_keys"
        SET "status" = 'rotated', "rotated_at" = now()
        WHERE "status" = 'active'
      `,
    );
  }

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
  if (process.env.JWKS_PRIVATE_KEY_PATH) {
    return readFileSync(resolve(process.env.JWKS_PRIVATE_KEY_PATH), 'utf8');
  }

  if (process.env.JWKS_PRIVATE_KEY) {
    return process.env.JWKS_PRIVATE_KEY.replace(/\\n/g, '\n');
  }

  throw new Error(
    'JWKS_PRIVATE_KEY_PATH or JWKS_PRIVATE_KEY is required to seed the active JWKS key',
  );
}
