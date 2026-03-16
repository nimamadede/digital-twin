import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserIdToStyleSamples20260316 implements MigrationInterface {
  name = 'AddUserIdToStyleSamples20260316';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Add nullable user_id column
    await queryRunner.query(
      `ALTER TABLE "style_samples" ADD COLUMN "user_id" uuid`,
    );

    // 2) Backfill user_id from related style_profiles (userId)
    await queryRunner.query(`
      UPDATE "style_samples" s
      SET "user_id" = p."user_id"
      FROM "style_profiles" p
      WHERE s."profile_id" = p."id" AND s."user_id" IS NULL
    `);

    // 3) Enforce NOT NULL and add FK + index
    await queryRunner.query(
      `ALTER TABLE "style_samples" ALTER COLUMN "user_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "style_samples" ADD CONSTRAINT "fk_style_samples_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_style_samples_user_profile" ON "style_samples" ("user_id", "profile_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_style_samples_user_profile"`,
    );
    await queryRunner.query(
      `ALTER TABLE "style_samples" DROP CONSTRAINT "fk_style_samples_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "style_samples" DROP COLUMN "user_id"`,
    );
  }
}

