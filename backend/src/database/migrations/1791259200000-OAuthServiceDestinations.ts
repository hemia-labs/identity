import { MigrationInterface, QueryRunner } from 'typeorm';

export class OAuthServiceDestinations1791259200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE oauth_clients ADD COLUMN service_destinations jsonb NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE oauth_tokens ADD COLUMN audience varchar(160) NULL`,
    );
    await queryRunner.query(
      `UPDATE oauth_tokens t SET audience = c.audience FROM oauth_clients c WHERE t.client_id = c.client_id AND t.user_id IS NULL AND t.session_id IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE oauth_clients ADD CONSTRAINT oauth_service_destinations_array CHECK (service_destinations IS NULL OR (jsonb_typeof(service_destinations) = 'array' AND jsonb_array_length(service_destinations) BETWEEN 1 AND 32))`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE oauth_tokens DROP COLUMN audience`);
    await queryRunner.query(
      `ALTER TABLE oauth_clients DROP COLUMN service_destinations`,
    );
  }
}
