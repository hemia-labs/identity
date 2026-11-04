import type { MigrationInterface, QueryRunner } from 'typeorm';

export class OAuthApiDescription1793318400001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE oauth_apis ADD COLUMN description varchar(2000) NOT NULL DEFAULT ''",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE oauth_apis DROP COLUMN description');
  }
}
