import { generateKeyPairSync, createPublicKey } from 'crypto';
import argon2 from 'argon2';
import { DataSource, QueryRunner } from 'typeorm';

const systemClients = [
  {
    clientId: 'horus',
    redirectUris: [
      'http://localhost:5180/auth/callback',
      'https://horus.hemia.dev/auth/callback',
    ],
  },
  {
    clientId: 'legal',
    redirectUris: ['http://localhost:3017/auth/callback'],
  },
  {
    clientId: 'console',
    redirectUris: ['http://localhost:3016/auth/callback'],
  },
  {
    clientId: 'billing',
    redirectUris: ['http://localhost:3015/auth/callback'],
  },
  {
    clientId: 'docs',
    redirectUris: ['http://localhost:3018/auth/callback'],
  },
  {
    clientId: 'access',
    redirectUris: ['http://localhost:3019/auth/callback'],
    scopes: [
      'openid',
      'profile',
      'email',
      'offline_access',
      'access.access',
      'identity.tokens.introspect',
    ],
  },
  {
    clientId: 'helpdesk',
    redirectUris: ['http://localhost:3020/auth/callback'],
  },
];

export async function seedInitialIdentity(dataSource: DataSource) {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    await seedAdmin(queryRunner);
    await seedJwks(queryRunner);
    await seedOAuthClients(queryRunner);
    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

async function seedAdmin(queryRunner: QueryRunner) {
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) throw new Error('SUPER_ADMIN_PASSWORD is required');

  await queryRunner.query(
    `
      INSERT INTO "users" (
        "email", "username", "password_hash", "first_name", "last_name",
        "status", "email_verified"
      )
      VALUES ($1, $2, $3, $4, $5, 'active', true)
      ON CONFLICT ("email") WHERE "deleted_at" IS NULL DO UPDATE
      SET
        "username" = EXCLUDED."username",
        "password_hash" = EXCLUDED."password_hash",
        "first_name" = EXCLUDED."first_name",
        "last_name" = EXCLUDED."last_name",
        "status" = 'active',
        "email_verified" = true,
        "updated_at" = now()
    `,
    [
      (process.env.SUPER_ADMIN_EMAIL ?? 'admin@hemia.cloud').toLowerCase(),
      (process.env.SUPER_ADMIN_USERNAME ?? 'superadmin').toLowerCase(),
      await argon2.hash(password, { type: argon2.argon2id }),
      process.env.SUPER_ADMIN_FIRST_NAME ?? 'Hemia',
      process.env.SUPER_ADMIN_LAST_NAME ?? 'Admin',
    ],
  );
}

async function seedJwks(queryRunner: QueryRunner) {
  const existing = await queryRunner.query(
    `SELECT 1 FROM "jwks_keys" WHERE "status" = 'active' LIMIT 1`,
  );
  if (existing.length) return;

  const privateKey =
    process.env.JWKS_PRIVATE_KEY ||
    generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    }).privateKey;
  const publicKey = createPublicKey(privateKey)
    .export({ type: 'spki', format: 'pem' })
    .toString();

  await queryRunner.query(
    `
      INSERT INTO "jwks_keys" ("kid", "alg", "public_key", "private_key_encrypted", "status")
      VALUES ($1, 'RS256', $2, $3, 'active')
      ON CONFLICT ("kid") DO NOTHING
    `,
    [process.env.JWKS_KEY_KID ?? `identity-${Date.now()}`, publicKey, privateKey],
  );
}

async function seedOAuthClients(queryRunner: QueryRunner) {
  await upsertClient(queryRunner, {
    clientId: 'identity-web',
    audience: 'identity-api',
    type: 'public',
    secretHash: null,
    redirectUris: (process.env.IDENTITY_WEB_REDIRECT_URIS ?? 'http://localhost:5173/auth/callback')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    grantTypes: ['authorization_code', 'refresh_token'],
  });

  await upsertClient(queryRunner, {
    clientId: 'identity-admin-service',
    audience: 'identity-api',
    type: 'confidential',
    secretHash: await clientSecretHash(queryRunner, 'identity-admin-service'),
    redirectUris: [],
    grantTypes: ['client_credentials'],
    scopes: [
      'identity.users.read',
      'identity.users.create',
      'identity.users.update',
      'identity.users.lock',
      'identity.users.unlock',
      'identity.users.delete',
      'identity.oauth_clients.read',
      'identity.oauth_clients.create',
      'identity.oauth_clients.update',
      'identity.oauth_clients.delete',
    ],
  });

  await upsertClient(queryRunner, {
    clientId: 'console-identity-admin',
    audience: 'identity-api',
    type: 'confidential',
    secretHash: await clientSecretHash(queryRunner, 'console-identity-admin'),
    redirectUris: [],
    grantTypes: ['client_credentials'],
    scopes: [
      'identity.users.read',
      'identity.users.create',
      'identity.users.update',
      'identity.users.lock',
      'identity.users.unlock',
      'identity.users.delete',
      'identity.oauth_clients.read',
      'identity.oauth_clients.create',
      'identity.oauth_clients.update',
      'identity.oauth_clients.delete',
    ],
  });

  await upsertClient(queryRunner, {
    clientId: 'console-access-admin',
    audience: 'access-api',
    type: 'confidential',
    secretHash: await clientSecretHash(queryRunner, 'console-access-admin'),
    redirectUris: [],
    grantTypes: ['client_credentials'],
    scopes: [
      'organization.read',
      'organization.update',
      'organization.archive',
      'membership.read',
      'membership.invite',
      'membership.suspend',
      'membership.revoke',
      'role.read',
      'role.assign',
      'role.revoke',
    ],
  });

  for (const client of systemClients) {
    await upsertClient(queryRunner, {
      ...client,
      audience: `${client.clientId}-api`,
      type: 'confidential',
      secretHash: await clientSecretHash(queryRunner, client.clientId),
      grantTypes: [
        'authorization_code',
        'client_credentials',
        'refresh_token',
        'urn:ietf:params:oauth:grant-type:token-exchange',
      ],
    });
  }
}

async function upsertClient(
  queryRunner: QueryRunner,
  input: {
    clientId: string;
    audience: string;
    type: 'public' | 'confidential';
    secretHash: string | null;
    redirectUris: string[];
    grantTypes: string[];
    scopes?: string[];
  },
) {
  await queryRunner.query(
    `
      INSERT INTO "oauth_clients" (
        "id", "client_id", "audience", "client_secret_hash", "type",
        "redirect_uris", "grant_types", "response_types", "scopes",
        "requires_consent", "status"
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6, ARRAY['code'], $7,
        false, 'active'
      )
      ON CONFLICT ("client_id") WHERE "deleted_at" IS NULL DO UPDATE
      SET
        "audience" = EXCLUDED."audience",
        "client_secret_hash" = "oauth_clients"."client_secret_hash",
        "type" = EXCLUDED."type",
        "redirect_uris" = EXCLUDED."redirect_uris",
        "grant_types" = EXCLUDED."grant_types",
        "response_types" = EXCLUDED."response_types",
        "scopes" = EXCLUDED."scopes",
        "requires_consent" = false,
        "status" = 'active',
        "updated_at" = now()
    `,
    [
      input.clientId,
      input.audience,
      input.secretHash,
      input.type,
      input.redirectUris,
      input.grantTypes,
      input.scopes ?? [
        'openid',
        'profile',
        'email',
        'offline_access',
        `${input.clientId}.access`,
      ],
    ],
  );
}

async function clientSecretHash(queryRunner: QueryRunner, clientId: string) {
  const [existing] = await queryRunner.query(
    `SELECT "client_secret_hash" FROM "oauth_clients" WHERE "client_id" = $1 AND "deleted_at" IS NULL`,
    [clientId],
  );
  if (existing?.client_secret_hash) return existing.client_secret_hash as string;

  const envName = `OAUTH_CLIENT_SECRET_${clientId.replace(/-/g, '_').toUpperCase()}`;
  const secret = process.env[envName];
  if (!secret) throw new Error(`${envName} is required for a new OAuth client`);
  return argon2.hash(secret, { type: argon2.argon2id });
}
