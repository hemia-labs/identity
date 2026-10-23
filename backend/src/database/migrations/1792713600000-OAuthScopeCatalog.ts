import type { MigrationInterface, QueryRunner } from 'typeorm';
export class OAuthScopeCatalog1792713600000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE oauth_scopes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(160) NOT NULL,
      audience varchar(160) NOT NULL, name varchar(200) NOT NULL,
      description varchar(2000) NOT NULL DEFAULT '', resource varchar(2048), enabled boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(audience,code));
      WITH registered AS (
        SELECT c.audience, unnest(c.scopes) AS code, NULL::text AS resource FROM oauth_clients c WHERE c.deleted_at IS NULL
        UNION ALL
        SELECT d->>'audience', s, d->>'resource' FROM oauth_clients c
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.service_destinations,'[]'::jsonb)) d
        CROSS JOIN LATERAL jsonb_array_elements_text(d->'scopes') s WHERE c.deleted_at IS NULL
      )
      INSERT INTO oauth_scopes(audience,code,name,resource)
      SELECT audience,code,code,CASE WHEN count(DISTINCT resource)=1 THEN min(resource) ELSE NULL END
      FROM registered WHERE code<>'' AND audience<>'' GROUP BY audience,code;`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE oauth_scopes');
  }
}
