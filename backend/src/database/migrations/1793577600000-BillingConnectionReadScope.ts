import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BillingConnectionReadScope1793577600000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const code = 'billing.integration.connections.read';
    await q.query(
      `INSERT INTO oauth_scopes (code, name, description, kind)
       VALUES ($1, $2, $3, 'api') ON CONFLICT (code) DO NOTHING`,
      [
        code,
        'Leer la configuración de la conexión',
        'Permite al cliente OAuth leer la configuración publicada de sus propias conexiones de Billing. No autoriza consultas de planes, cobros ni licencias.',
      ],
    );
    await q.query(
      `INSERT INTO oauth_apis (audience, name)
       VALUES ('billing-api', 'Hemia Billing') ON CONFLICT (audience) DO NOTHING`,
    );
    await q.query(
      `INSERT INTO oauth_api_scopes (api_id, scope_id)
       SELECT a.id, s.id FROM oauth_apis a CROSS JOIN oauth_scopes s
       WHERE a.audience = 'billing-api' AND s.code = $1 AND s.kind = 'api'
       ON CONFLICT DO NOTHING`,
      [code],
    );
  }

  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Review configured client grants before removing the connection read scope.',
      ),
    );
  }
}
