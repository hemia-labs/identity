import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmptyOAuthServiceDestinations1792800000001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE oauth_clients DROP CONSTRAINT oauth_service_destinations_array`,
    );
    await queryRunner.query(
      `ALTER TABLE oauth_clients ADD CONSTRAINT oauth_service_destinations_array CHECK (service_destinations IS NULL OR (jsonb_typeof(service_destinations) = 'array' AND jsonb_array_length(service_destinations) BETWEEN 0 AND 32))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const empty = (await queryRunner.query(
      `SELECT id FROM oauth_clients WHERE service_destinations = '[]'::jsonb LIMIT 1`,
    )) as Array<{ id: string }>;
    if (empty.length)
      throw new Error(
        'Cannot restore the nonempty destination constraint while deny-all policies exist; do not convert them to null.',
      );
    await queryRunner.query(
      `ALTER TABLE oauth_clients DROP CONSTRAINT oauth_service_destinations_array`,
    );
    await queryRunner.query(
      `ALTER TABLE oauth_clients ADD CONSTRAINT oauth_service_destinations_array CHECK (service_destinations IS NULL OR (jsonb_typeof(service_destinations) = 'array' AND jsonb_array_length(service_destinations) BETWEEN 1 AND 32))`,
    );
  }
}
