import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentConnectionScopes1792800000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // Definitions do not grant access. Resolve a resource only when the existing catalog is unambiguous.
    for (const [audience, code, name] of [
      [
        'identity-api',
        'identity.tokens.introspect',
        'Verificar tokens entrantes',
      ],
      [
        'billing-api',
        'billing.integration.catalog.read',
        'Consultar planes de pago',
      ],
      ['billing-api', 'billing.integration.checkout.create', 'Crear cobros'],
      ['billing-api', 'billing.integration.checkout.read', 'Consultar cobros'],
      [
        'billing-api',
        'billing.integration.licenses.read',
        'Consultar licencias',
      ],
      [
        'billing-api',
        'billing.integrations.read',
        'Consultar conexiones de pagos',
      ],
      [
        'billing-api',
        'billing.integrations.manage',
        'Administrar conexiones de pagos',
      ],
      [
        'balanz-api',
        'billing.connections.check',
        'Comprobar conexión de pagos',
      ],
    ]) {
      await q.query(
        `INSERT INTO oauth_scopes(audience,code,name,resource)
         SELECT $1::varchar,$2::varchar,$3::varchar,CASE WHEN count(DISTINCT resource)=1 THEN min(resource) ELSE NULL END
         FROM oauth_scopes WHERE audience=$1::varchar
         ON CONFLICT(audience,code) DO NOTHING`,
        [audience, code, name],
      );
    }
  }

  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Scope definitions may be referenced by connections; restore the development snapshot as a unit.',
      ),
    );
  }
}
