import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1783732939094 implements MigrationInterface {
  name = 'Migration1783732939094';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'inactive', 'pending', 'locked', 'deleted')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(320) NOT NULL, "username" character varying(100), "password_hash" character varying(255), "first_name" character varying(100) NOT NULL, "last_name" character varying(100) NOT NULL, "avatar_url" character varying(2048), "email_verified" boolean NOT NULL DEFAULT false, "status" "public"."users_status_enum" NOT NULL DEFAULT 'pending', "locked_at" TIMESTAMP WITH TIME ZONE, "last_login_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_username_active_unique" ON "users" ("username") WHERE "deleted_at" IS NULL AND "username" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_email_active_unique" ON "users" ("email") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "session_family_id" uuid NOT NULL, "refresh_token_hash" character varying(255) NOT NULL, "device_name" character varying(160), "ip_address" inet, "user_agent" text, "is_active" boolean NOT NULL DEFAULT true, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sessions_is_active" ON "sessions" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sessions_expires_at" ON "sessions" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sessions_family_id" ON "sessions" ("session_family_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sessions_user_id" ON "sessions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "session_id" uuid NOT NULL, "family_id" uuid NOT NULL, "token_hash" character varying(255) NOT NULL, "previous_token_hash" character varying(255), "is_used" boolean NOT NULL DEFAULT false, "is_revoked" boolean NOT NULL DEFAULT false, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_expires_at" ON "refresh_tokens" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_family_id" ON "refresh_tokens" ("family_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_session_id" ON "refresh_tokens" ("session_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "oidc_id_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token_hash" character varying(64) NOT NULL, "client_id" character varying(120) NOT NULL, "user_id" uuid NOT NULL, "kid" character varying(80) NOT NULL, "nonce" text, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_82929a701abf6675472479d482c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_oidc_id_tokens_token_hash" ON "oidc_id_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "oauth_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token_hash" character varying(64) NOT NULL, "refresh_token_hash" character varying(64), "client_id" character varying(120) NOT NULL, "user_id" uuid, "session_id" uuid, "scope" text NOT NULL, "family_id" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_71c8b8060826696206f973554fd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_oauth_tokens_family_id" ON "oauth_tokens" ("family_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_oauth_tokens_client_id" ON "oauth_tokens" ("client_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_oauth_tokens_refresh_token_hash" ON "oauth_tokens" ("refresh_token_hash") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_oauth_tokens_token_hash" ON "oauth_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."oauth_clients_type_enum" AS ENUM('public', 'confidential')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."oauth_clients_status_enum" AS ENUM('active', 'suspended', 'deleted')`,
    );
    await queryRunner.query(
      `CREATE TABLE "oauth_clients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "client_id" character varying(120) NOT NULL, "audience" character varying(160) NOT NULL, "client_secret_hash" character varying(255), "type" "public"."oauth_clients_type_enum" NOT NULL, "redirect_uris" text array NOT NULL DEFAULT '{}', "grant_types" text array NOT NULL DEFAULT '{}', "response_types" text array NOT NULL DEFAULT '{}', "scopes" text array NOT NULL DEFAULT '{}', "requires_consent" boolean NOT NULL DEFAULT true, "status" "public"."oauth_clients_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_c4759172d3431bae6f04e678e0d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_oauth_clients_client_id_active_unique" ON "oauth_clients" ("client_id") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "oauth_authorization_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code_hash" character varying(64) NOT NULL, "client_id" character varying(120) NOT NULL, "user_id" uuid NOT NULL, "session_id" uuid NOT NULL, "redirect_uri" text NOT NULL, "scope" text NOT NULL, "code_challenge" text NOT NULL, "code_challenge_method" character varying(10) NOT NULL, "nonce" text, "state" text, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_441350d3fce3606534fbb2c1197" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_oauth_authorization_codes_expires_at" ON "oauth_authorization_codes" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_oauth_authorization_codes_client_id" ON "oauth_authorization_codes" ("client_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_oauth_authorization_codes_code_hash" ON "oauth_authorization_codes" ("code_hash") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."jwks_keys_status_enum" AS ENUM('active', 'rotated', 'revoked')`,
    );
    await queryRunner.query(
      `CREATE TABLE "jwks_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kid" character varying(80) NOT NULL, "alg" character varying(20) NOT NULL DEFAULT 'RS256', "public_key" text NOT NULL, "private_key_encrypted" text NOT NULL, "status" "public"."jwks_keys_status_enum" NOT NULL DEFAULT 'active', "rotated_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f34118b5ad5b54a309e5fd0fdd2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_jwks_keys_kid" ON "jwks_keys" ("kid") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."identity_events_type_enum" AS ENUM('user.created', 'user.updated', 'user.suspended', 'user.deleted', 'auth.login_succeeded', 'auth.login_failed', 'auth.token_issued', 'auth.session_revoked')`,
    );
    await queryRunner.query(
      `CREATE TABLE "identity_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."identity_events_type_enum" NOT NULL, "user_id" uuid, "payload" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7922f2737a3ca5bbc54b1da0601" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_identity_events_created_at" ON "identity_events" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_identity_events_type" ON "identity_events" ("type") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."external_accounts_provider_enum" AS ENUM('google')`,
    );
    await queryRunner.query(
      `CREATE TABLE "external_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "provider" "public"."external_accounts_provider_enum" NOT NULL, "provider_account_id" character varying(255) NOT NULL, "email" character varying(320) NOT NULL, "email_verified" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_48de4cf673dd62798b19df4f7bd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_external_accounts_user_id" ON "external_accounts" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_external_accounts_provider_account_active_unique" ON "external_accounts" ("provider", "provider_account_id") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "oauth_consents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "client_id" character varying(120) NOT NULL, "scopes" text array NOT NULL, "granted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_0a4d44789a8f412ccdbed87a590" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_oauth_consents_user_client" ON "oauth_consents" ("user_id", "client_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3bf308fa93da3966f9e76fcfba4" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "external_accounts" ADD CONSTRAINT "FK_50528d2b5b07136b36ed2954247" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "external_accounts" DROP CONSTRAINT "FK_50528d2b5b07136b36ed2954247"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3bf308fa93da3966f9e76fcfba4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_oauth_consents_user_client"`,
    );
    await queryRunner.query(`DROP TABLE "oauth_consents"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_external_accounts_provider_account_active_unique"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_external_accounts_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "external_accounts"`);
    await queryRunner.query(
      `DROP TYPE "public"."external_accounts_provider_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_identity_events_type"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_identity_events_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "identity_events"`);
    await queryRunner.query(`DROP TYPE "public"."identity_events_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_jwks_keys_kid"`);
    await queryRunner.query(`DROP TABLE "jwks_keys"`);
    await queryRunner.query(`DROP TYPE "public"."jwks_keys_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_oauth_authorization_codes_code_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_oauth_authorization_codes_client_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_oauth_authorization_codes_expires_at"`,
    );
    await queryRunner.query(`DROP TABLE "oauth_authorization_codes"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_oauth_clients_client_id_active_unique"`,
    );
    await queryRunner.query(`DROP TABLE "oauth_clients"`);
    await queryRunner.query(`DROP TYPE "public"."oauth_clients_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."oauth_clients_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_oauth_tokens_token_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_oauth_tokens_refresh_token_hash"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_oauth_tokens_client_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_oauth_tokens_family_id"`);
    await queryRunner.query(`DROP TABLE "oauth_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_oidc_id_tokens_token_hash"`,
    );
    await queryRunner.query(`DROP TABLE "oidc_id_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_refresh_tokens_session_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_refresh_tokens_family_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_refresh_tokens_token_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_refresh_tokens_expires_at"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sessions_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sessions_family_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sessions_expires_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sessions_is_active"`);
    await queryRunner.query(`DROP TABLE "sessions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_users_email_active_unique"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_users_username_active_unique"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
  }
}
