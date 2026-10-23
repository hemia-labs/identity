import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SubscriptionManagementScope1793062800001 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // Catalog definitions never grant clients access; Console owns those grants.
    await q.query(
      `INSERT INTO oauth_scopes(audience,code,name,description,resource)
       SELECT $1::varchar,$2::varchar,$3::varchar,$4::varchar,
         CASE WHEN count(DISTINCT resource)=1 THEN min(resource) ELSE NULL END
       FROM oauth_scopes WHERE audience=$1::varchar AND enabled AND resource IS NOT NULL
       ON CONFLICT(audience,code) DO NOTHING`,
      [
        'billing-api',
        'billing.subscriptions.manage',
        'Gestionar suscripciones',
        'Consultar, cambiar y cancelar las suscripciones del producto autorizado.',
      ],
    );
  }

  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Scope definitions may be referenced by connections; restore a verified snapshot to preserve configured grants.',
      ),
    );
  }
}
