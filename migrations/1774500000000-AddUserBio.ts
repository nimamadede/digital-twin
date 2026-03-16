import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserBio1774500000000 implements MigrationInterface {
  name = 'AddUserBio1774500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "bio" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`);
  }
}
