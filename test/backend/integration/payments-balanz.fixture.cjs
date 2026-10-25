const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const root = require('node:path').resolve(__dirname, '../../../../../balanz/apps/api');
const req = createRequire(root + '/package.json');
const load = (file, symbol) => req(root + '/dist/' + file + '.js')[symbol];
const { DataSource } = req('typeorm');
const { ConfigService } = req('@nestjs/config');
const { Module, UnauthorizedException } = req('@nestjs/common');
const { NestFactory, Reflector } = req('@nestjs/core');
const { PaymentsModule, PaymentsService } = req('@hemia/payments/nestjs');
const User = load('modules/users/entities/user.entity', 'User');
const Organization = load('modules/organizations/entities/organization.entity', 'Organization');
const Membership = load('modules/memberships/entities/membership.entity', 'Membership');
const Role = load('modules/permissions/entities/role.entity', 'Role');
const Permission = load('modules/permissions/entities/permission.entity', 'Permission');
const RolePermission = load('modules/permissions/entities/role-permission.entity', 'RolePermission');
const MembershipPermission = load('modules/permissions/entities/membership-permission.entity', 'MembershipPermission');
const AuthFactor = load('modules/auth/entities/auth-factor.entity', 'AuthFactor');
const AuthSession = load('modules/sessions/entities/auth-session.entity', 'AuthSession');

module.exports = async function createBalanzFixture(options, settings) {
  if (options.host !== '127.0.0.1' || options.port < 15000 || !/test|fixture|validation|_flow$/.test(options.database)) throw Error('Disposable database required');
  const db = new DataSource({ ...options, type: 'postgres', entities: [User, Organization, Membership, Role, Permission, RolePermission, MembershipPermission, AuthFactor, AuthSession], synchronize: false, migrationsRun: false, logging: false });
  await db.initialize();
  await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await db.query(`DO $$ BEGIN CREATE ROLE balanz_api NOLOGIN NOBYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE balanz_worker NOLOGIN NOBYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE balanz_fiscal_reconcile_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  for (const [file, name] of [
    ['1787601284711-Migration', 'Migration1787601284711'],
    ['1787690000000-IdentityIntegrity', 'IdentityIntegrity1787690000000'],
    ['1787690050000-AuthorizationModel', 'AuthorizationModel1787690050000'],
    ['1787690600000-SessionReauthentication', 'SessionReauthentication1787690600000'],
    ['1792886500000-PaymentsModuleIntegration', 'PaymentsModuleIntegration1792886500000'],
  ]) {
    await db.transaction(async manager => new (load('database/migrations/' + file, name))().up(manager.queryRunner));
  }
  await db.query('GRANT SELECT ON organizations,memberships TO balanz_api,balanz_worker');
  const userId = settings.userId ?? randomUUID(), organizationId = settings.organizationId ?? randomUUID(), membershipId = randomUUID(), sessionId = randomUUID();
  const now = new Date();
  await db.getRepository(User).save({ id: userId, firstName: 'Fixture', lastName: 'Buyer', email: userId + '@example.test', passwordHash: 'fixture-not-login', status: 'active', emailVerifiedAt: now });
  await db.getRepository(Organization).save({ id: organizationId, name: 'Fixture tenant', slug: 'fixture-' + organizationId, ownerUserId: userId, status: 'active' });
  let role = await db.getRepository(Role).findOneBy({ key: 'admin' });
  if (!role) role = await db.getRepository(Role).save({ key: 'admin', name: 'Admin fixture', description: 'Test only', scope: 'organization' });
  let permission = await db.getRepository(Permission).findOneBy({ key: 'billing.manage' });
  if (!permission) permission = await db.getRepository(Permission).save({ key: 'billing.manage', name: 'Billing', description: 'Test', status: 'active', sensitive: true, requiresMfa: true, requiresReauthentication: false });
  await db.getRepository(RolePermission).save({ roleId: role.id, permissionId: permission.id, enabled: true });
  await db.getRepository(Membership).save({ id: membershipId, userId, organizationId, roleId: role.id, status: 'active', joinedAt: now });
  await db.getRepository(AuthFactor).save({ userId, status: 'active', secretEncrypted: 'fixture-not-a-real-secret', verifiedAt: now });
  const session = await db.getRepository(AuthSession).save({ id: sessionId, userId, organizationId, membershipId, sessionTokenHash: 'a'.repeat(64), status: 'active', requiresMfa: true, mfaVerifiedAt: now, reauthenticatedAt: now, expiresAt: new Date(Date.now() + 3600000), lastActivityAt: now });
  const AuthorizationService = load('modules/sessions/authorization.service', 'AuthorizationService');
  const auth = new AuthorizationService(db.getRepository(User), db.getRepository(Organization), db.getRepository(Membership), db.getRepository(RolePermission), db.getRepository(AuthFactor), db, db.getRepository(MembershipPermission));
  const config = new ConfigService(settings.config ?? {});
  const FiscalTenantTransactionService = load('database/rls/fiscal-tenant-transaction.service', 'FiscalTenantTransactionService');
  const PaymentsApplicationService = load('modules/billing/payments-application.service', 'PaymentsApplicationService');
  const SessionGuard = load('common/guards/session.guard', 'SessionGuard');
  const TenantAccessGuard = load('common/guards/tenant-access.guard', 'TenantAccessGuard');
  const PermissionsGuard = load('common/guards/permissions.guard', 'PermissionsGuard');
  const transactions = new FiscalTenantTransactionService(db);
  // The harness supplies an explicit test session. Balanz's actual session/tenant/permission guards still run.
  const sessions = new SessionGuard({ resolve: async request => {
    if (request.headers['x-balanz-fixture-session'] !== session.id) throw new UnauthorizedException();
    const current = await db.getRepository(AuthSession).findOneByOrFail({ id: session.id });
    return { session: current, context: await auth.resolve(current) };
  } });
  const application = new PaymentsApplicationService(config, db, auth, sessions, new TenantAccessGuard(), new PermissionsGuard(new Reflector(), { recordDirect: async () => {} }), transactions);
  const connection = settings.config.payments.connection;
  class FixtureApplication {}
  Module({ imports: [PaymentsModule.forRootAsync({ useFactory: () => ({
    connection, clientSecret: settings.config.payments.clientSecret, dataSource: db,
    authorize: (request, operation) => application.authorize(request, operation),
    returnUrls: (context, attemptId) => application.returnUrls(context, attemptId),
    scopeTransaction: (manager, scope) => application.scopeTransaction(manager, scope),
    legal: { ...connection.legal, resolveContext: input => application.resolveLegalContext(input) },
  }) })] })(FixtureApplication);
  const app = await NestFactory.create(FixtureApplication, { logger: false });
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  const base = 'http://127.0.0.1:' + app.getHttpServer().address().port;
  const call = async (path, body, headers = {}) => {
    const response = await fetch(base + '/api/v1/payments/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', 'x-balanz-fixture-session': session.id, ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json();
    if (!response.ok) throw Object.assign(new Error(value.message), { status: response.status });
    return value;
  };
  const proxy = async request => {
    const response = await fetch(base + request.url, {
      method: request.method,
      headers: { 'content-type': 'application/json', ...(request.headers.authorization ? { authorization: request.headers.authorization } : {}), ...(request.headers['x-billing-timestamp'] ? { 'x-billing-timestamp': request.headers['x-billing-timestamp'] } : {}) },
      ...(['GET', 'HEAD'].includes(request.method) ? {} : { body: JSON.stringify(request.body) }),
    });
    const value = await response.json();
    if (!response.ok) throw Object.assign(new Error(value.message), { status: response.status });
    return value;
  };
  const legal = {
    prepare: (_session, key) => call('legal/prepare', { idempotencyKey: key }),
    accept: (_session, input) => call('legal/accept', input),
  };
  const payments = app.get(PaymentsService);
  const access = { get: scope => payments.getLicense({ ...scope, subjectId: userId }) };
  return { db, userId, organizationId, membershipId, sessionId, session, auth, legal, access, config, call, proxy, app, close: async () => { await app.close(); await db.destroy(); } };
};
