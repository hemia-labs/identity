import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueOAuthScopeCatalog1793062800002 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // Lock the source dictionaries and grants so the imported associations share one snapshot.
    await q.query(
      'LOCK TABLE oauth_scopes, oauth_clients IN SHARE ROW EXCLUSIVE MODE',
    );
    await q.query(`CREATE TABLE oauth_scopes_before_unique_catalog AS TABLE oauth_scopes;
      CREATE TEMP TABLE imported_oauth_permissions ON COMMIT DROP AS
      SELECT audience,code,resource FROM oauth_scopes
      UNION ALL SELECT audience,unnest(scopes),NULL::varchar FROM oauth_clients
      UNION ALL SELECT d->>'audience',s,d->>'resource' FROM oauth_clients c
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.service_destinations,'[]'::jsonb)) d
        CROSS JOIN LATERAL jsonb_array_elements_text(d->'scopes') s;
      CREATE TEMP TABLE imported_oauth_apis ON COMMIT DROP AS
      SELECT audience,resource FROM imported_oauth_permissions
      UNION ALL SELECT audience,NULL::varchar FROM oauth_clients
      UNION ALL SELECT d->>'audience',d->>'resource' FROM oauth_clients c
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.service_destinations,'[]'::jsonb)) d;
      DO $$ BEGIN
        IF EXISTS(SELECT 1 FROM imported_oauth_apis WHERE audience<>'' GROUP BY audience HAVING count(DISTINCT resource) FILTER (WHERE resource IS NOT NULL AND resource<>'')>1) THEN
          RAISE EXCEPTION 'OAuth catalog: an audience has conflicting resource URLs; resolve before retrying';
        END IF;
        IF EXISTS(SELECT 1 FROM imported_oauth_apis WHERE audience<>'' AND resource IS NOT NULL AND resource<>'' GROUP BY resource HAVING count(DISTINCT audience)>1) THEN
          RAISE EXCEPTION 'OAuth catalog: a resource has conflicting audiences; resolve before retrying';
        END IF;
      END $$;
      CREATE TABLE oauth_apis (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(200) NOT NULL,
        audience varchar(160) NOT NULL UNIQUE, resource varchar(2048) UNIQUE,
        enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
      INSERT INTO oauth_apis(name,audience,resource)
        SELECT audience,audience,min(NULLIF(resource,'')) FROM imported_oauth_apis WHERE audience IS NOT NULL AND audience<>'' GROUP BY audience;
      DROP TABLE oauth_scopes;
      CREATE TABLE oauth_scopes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(160) NOT NULL UNIQUE,
        name varchar(200) NOT NULL, description varchar(2000) NOT NULL DEFAULT '',
        enabled boolean NOT NULL DEFAULT true, kind varchar(16) NOT NULL CHECK(kind IN ('protocol','api')),
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
      INSERT INTO oauth_scopes(id,code,name,description,enabled,kind,created_at,updated_at)
        SELECT min(id::text)::uuid,code,
          (array_agg(name ORDER BY (name=code),created_at,id))[1],
          (array_agg(description ORDER BY (description=''),created_at,id))[1],bool_and(enabled),
          CASE WHEN code IN ('openid','profile','email','address','phone','offline_access') THEN 'protocol' ELSE 'api' END,
          min(created_at),max(updated_at)
        FROM oauth_scopes_before_unique_catalog GROUP BY code;
      INSERT INTO oauth_scopes(code,name,kind)
        SELECT DISTINCT code,code,CASE WHEN code IN ('openid','profile','email','address','phone','offline_access') THEN 'protocol' ELSE 'api' END
        FROM imported_oauth_permissions WHERE code IS NOT NULL AND code<>'' ON CONFLICT(code) DO NOTHING;
      INSERT INTO oauth_scopes(code,name,description,kind) VALUES
        ('openid','Iniciar sesión','Autenticación OpenID Connect e ID token.','protocol'),
        ('profile','Perfil del usuario','Claims básicos del perfil OIDC.','protocol'),
        ('email','Correo del usuario','Claims de correo OIDC.','protocol'),
        ('address','Dirección del usuario','Claims de dirección OIDC.','protocol'),
        ('phone','Teléfono del usuario','Claims de teléfono OIDC.','protocol'),
        ('offline_access','Acceso offline','Solicitud de acceso offline mediante refresh token.','protocol')
        ON CONFLICT(code) DO NOTHING;
      CREATE TABLE oauth_api_scopes (
        api_id uuid NOT NULL REFERENCES oauth_apis(id) ON DELETE RESTRICT,
        scope_id uuid NOT NULL REFERENCES oauth_scopes(id) ON DELETE RESTRICT,
        PRIMARY KEY(api_id,scope_id));
      CREATE INDEX oauth_api_scopes_scope_idx ON oauth_api_scopes(scope_id);
      INSERT INTO oauth_api_scopes(api_id,scope_id)
        SELECT DISTINCT a.id,s.id FROM imported_oauth_permissions p JOIN oauth_apis a ON a.audience=p.audience
        JOIN oauth_scopes s ON s.code=p.code WHERE s.kind='api';
      ALTER TABLE oauth_authorization_codes ADD COLUMN audience varchar(160);`);
  }

  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Automatic rollback would discard catalog edits. Restore oauth_scopes_before_unique_catalog only after reconciling APIs, scopes and issued authorization codes.',
      ),
    );
  }
}
