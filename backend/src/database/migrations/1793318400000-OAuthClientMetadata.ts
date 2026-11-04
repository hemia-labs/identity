import type { MigrationInterface, QueryRunner } from 'typeorm';

export class OAuthClientMetadata1793318400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE oauth_clients ADD COLUMN name varchar(200), ADD COLUMN description varchar(2000)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE oauth_clients DROP COLUMN description, DROP COLUMN name',
    );
  }
}
