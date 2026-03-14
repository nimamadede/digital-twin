import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageExportTasks1742000000000 implements MigrationInterface {
  name = 'MessageExportTasks1742000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "message_export_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "fileUploadId" uuid,
        "errorMessage" text,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid,
        "file_upload_id" uuid,
        CONSTRAINT "PK_message_export_tasks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_message_export_tasks_user_id" ON "message_export_tasks" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_message_export_tasks_status" ON "message_export_tasks" ("userId", "status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_export_tasks" ADD CONSTRAINT "FK_message_export_tasks_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_export_tasks" ADD CONSTRAINT "FK_message_export_tasks_file" FOREIGN KEY ("file_upload_id") REFERENCES "file_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message_export_tasks" DROP CONSTRAINT "FK_message_export_tasks_file"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_export_tasks" DROP CONSTRAINT "FK_message_export_tasks_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "idx_message_export_tasks_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "idx_message_export_tasks_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "message_export_tasks"`);
  }
}
