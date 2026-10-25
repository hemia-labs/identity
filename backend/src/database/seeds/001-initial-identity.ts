import { generateKeyPairSync, createPublicKey, randomBytes } from 'crypto';
import argon2 from 'argon2';
import { DataSource, QueryRunner } from 'typeorm';

const systemClients = [
  {
    clientId: 'legal',
    redirectUris: ['http://localhost:3017/auth/callback'],
    scopes: [
      'openid',
      'profile',
      'email',
      'offline_access',
      'legal.access',
      'legal.self.pending.read',
      'legal.self.acceptances.create',
      'legal.self.acceptances.read',
    ],
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
  const email = (
    process.env.SUPER_ADMIN_EMAIL ?? 'admin@hemia.cloud'
  ).toLowerCase();
  const existing = (await queryRunner.query(
    `SELECT 1 FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [email],
  )) as unknown[];
  if (existing.length) return;

  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) throw new Error('SUPER_ADMIN_PASSWORD is required');

  await queryRunner.query(
    `
      INSERT INTO "users" (
        "email", "username", "password_hash", "first_name", "last_name",
        "status", "email_verified"
      )
      VALUES ($1, $2, $3, $4, $5, 'active', true)
      ON CONFLICT ("email") WHERE "deleted_at" IS NULL DO NOTHING
    `,
    [
      email,
      (process.env.SUPER_ADMIN_USERNAME ?? 'superadmin').toLowerCase(),
      await argon2.hash(password, { type: argon2.argon2id }),
      process.env.SUPER_ADMIN_FIRST_NAME ?? 'Hemia',
      process.env.SUPER_ADMIN_LAST_NAME ?? 'Admin',
    ],
  );
}

async function seedJwks(queryRunner: QueryRunner) {
  const existing = (await queryRunner.query(
    `SELECT 1 FROM "jwks_keys" WHERE "status" = 'active' LIMIT 1`,
  )) as unknown[];
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
    [
      process.env.JWKS_KEY_KID ?? `identity-${Date.now()}`,
      publicKey,
      privateKey,
    ],
  );
}

async function seedOAuthClients(queryRunner: QueryRunner) {
  await insertClient(queryRunner, {
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

  await insertClient(queryRunner, {
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
      'product_access.read',
      'product_access.enable',
      'product_access.suspend',
      'product_access.disable',
      'audit.read',
    ],
  });

  await insertClient(queryRunner, {
    clientId: 'billing-legal-service',
    audience: 'legal-api',
    type: 'confidential',
    secretHash: await clientSecretHash(queryRunner, 'billing-legal-service'),
    redirectUris: [],
    grantTypes: ['client_credentials'],
    scopes: [
      'legal.documents.read',
      'legal.acceptances.read',
      'legal.pending.evaluate',
      'legal.acceptances.validate',
      'legal.integration.acceptances.validate',
    ],
  });

  await insertClient(queryRunner, {
    clientId: 'access-legal-validator',
    audience: 'legal-api',
    type: 'confidential',
    secretHash: await clientSecretHash(queryRunner, 'access-legal-validator'),
    redirectUris: [],
    grantTypes: ['client_credentials'],
    responseTypes: [],
    scopes: ['legal.authorization.targets.validate'],
  });

  await insertClient(queryRunner, {
    clientId: 'balanz-billing-service',
    audience: 'billing-api',
    type: 'confidential',
    secretHash: await clientSecretHash(queryRunner, 'balanz-billing-service'),
    redirectUris: [],
    grantTypes: ['client_credentials'],
    responseTypes: [],
    scopes: [
      'billing.integration.catalog.read',
      'billing.integration.checkout.create',
      'billing.integration.checkout.read',
      'billing.integration.licenses.read',
    ],
  });

  await insertClient(queryRunner, {
    clientId: 'legal-service-dev',
    audience: 'identity-api',
    type: 'confidential',
    secretHash: await clientSecretHash(queryRunner, 'legal-service-dev'),
    redirectUris: [],
    grantTypes: ['client_credentials'],
    responseTypes: [],
    scopes: [],
  });

  for (const client of systemClients) {
    await insertClient(queryRunner, {
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

async function insertClient(
  queryRunner: QueryRunner,
  input: {
    clientId: string;
    audience: string;
    type: 'public' | 'confidential';
    secretHash: string | null;
    redirectUris: string[];
    grantTypes: string[];
    scopes?: string[];
    responseTypes?: string[];
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
        $5, $6, $8, $7,
        false, 'active'
      )
      ON CONFLICT ("client_id") WHERE "deleted_at" IS NULL DO NOTHING
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
      input.responseTypes ?? ['code'],
    ],
  );
}

async function clientSecretHash(queryRunner: QueryRunner, clientId: string) {
  const [existing] = (await queryRunner.query(
    `SELECT "client_secret_hash" FROM "oauth_clients" WHERE "client_id" = $1 AND "deleted_at" IS NULL`,
    [clientId],
  )) as Array<{ client_secret_hash: string | null }>;
  if (existing) return existing.client_secret_hash;

  const envName = `OAUTH_CLIENT_SECRET_${clientId.replace(/-/g, '_').toUpperCase()}`;
  const secret =
    process.env[envName] ?? generateClientSecret(clientId, envName);
  return argon2.hash(secret, { type: argon2.argon2id });
}

function generateClientSecret(clientId: string, envName: string) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${envName} is required for a new OAuth client`);
  }
  const secret = randomBytes(32).toString('base64url');
  console.log(JSON.stringify({ client_id: clientId, secret }));
  return secret;
}
