import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoutingTables1774000000000 implements MigrationInterface {
  name = 'AddRoutingTables1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- routing_rules (must be created first, routing_logs references it) ---
    await queryRunner.query(`
      CREATE TABLE "routing_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "priority" integer NOT NULL DEFAULT '50',
        "isEnabled" boolean NOT NULL DEFAULT true,
        "isSystem" boolean NOT NULL DEFAULT false,
        "type" character varying(20) NOT NULL DEFAULT 'route',
        "conditions" jsonb NOT NULL DEFAULT '{}',
        "action" character varying(30) NOT NULL,
        "actionConfig" jsonb NOT NULL DEFAULT '{}',
        "triggerCount" integer NOT NULL DEFAULT '0',
        "lastTriggeredAt" TIMESTAMP,
        "user_id" uuid,
        CONSTRAINT "PK_routing_rules" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_routing_rules_user_id" ON "routing_rules" ("userId")`);
    await queryRunner.query(`CREATE INDEX "idx_routing_rules_user_priority" ON "routing_rules" ("userId", "priority")`);
    await queryRunner.query(`CREATE INDEX "idx_routing_rules_user_enabled" ON "routing_rules" ("userId", "isEnabled")`);
    await queryRunner.query(`ALTER TABLE "routing_rules" ADD CONSTRAINT "FK_routing_rules_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);

    // --- routing_logs ---
    await queryRunner.query(`
      CREATE TABLE "routing_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "messageId" uuid NOT NULL,
        "contactId" uuid NOT NULL,
        "platform" character varying(30) NOT NULL,
        "incomingContent" text NOT NULL,
        "matchedRuleId" uuid,
        "sceneId" uuid,
        "profileId" uuid,
        "replyRecordId" uuid,
        "action" character varying(30) NOT NULL,
        "reason" character varying(100),
        "replySentContent" text,
        "steps" jsonb NOT NULL DEFAULT '[]',
        "processingTime" integer NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid,
        "message_id" uuid,
        "contact_id" uuid,
        "matched_rule_id" uuid,
        "scene_id" uuid,
        "profile_id" uuid,
        "reply_record_id" uuid,
        CONSTRAINT "PK_routing_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_routing_logs_user_id" ON "routing_logs" ("userId")`);
    await queryRunner.query(`CREATE INDEX "idx_routing_logs_user_created" ON "routing_logs" ("userId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "idx_routing_logs_action" ON "routing_logs" ("userId", "action")`);
    await queryRunner.query(`CREATE INDEX "idx_routing_logs_contact" ON "routing_logs" ("userId", "contactId")`);
    await queryRunner.query(`CREATE INDEX "idx_routing_logs_scene" ON "routing_logs" ("userId", "sceneId")`);
    await queryRunner.query(`CREATE INDEX "idx_routing_logs_rule" ON "routing_logs" ("userId", "matchedRuleId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_routing_logs_message" ON "routing_logs" ("messageId")`);

    // Foreign keys
    await queryRunner.query(`ALTER TABLE "routing_logs" ADD CONSTRAINT "FK_routing_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "routing_logs" ADD CONSTRAINT "FK_routing_logs_message" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "routing_logs" ADD CONSTRAINT "FK_routing_logs_contact" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "routing_logs" ADD CONSTRAINT "FK_routing_logs_matched_rule" FOREIGN KEY ("matched_rule_id") REFERENCES "routing_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "routing_logs" ADD CONSTRAINT "FK_routing_logs_scene" FOREIGN KEY ("scene_id") REFERENCES "scene_modes"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "routing_logs" ADD CONSTRAINT "FK_routing_logs_profile" FOREIGN KEY ("profile_id") REFERENCES "style_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "routing_logs" ADD CONSTRAINT "FK_routing_logs_reply_record" FOREIGN KEY ("reply_record_id") REFERENCES "reply_records"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop routing_logs foreign keys
    await queryRunner.query(`ALTER TABLE "routing_logs" DROP CONSTRAINT "FK_routing_logs_reply_record"`);
    await queryRunner.query(`ALTER TABLE "routing_logs" DROP CONSTRAINT "FK_routing_logs_profile"`);
    await queryRunner.query(`ALTER TABLE "routing_logs" DROP CONSTRAINT "FK_routing_logs_scene"`);
    await queryRunner.query(`ALTER TABLE "routing_logs" DROP CONSTRAINT "FK_routing_logs_matched_rule"`);
    await queryRunner.query(`ALTER TABLE "routing_logs" DROP CONSTRAINT "FK_routing_logs_contact"`);
    await queryRunner.query(`ALTER TABLE "routing_logs" DROP CONSTRAINT "FK_routing_logs_message"`);
    await queryRunner.query(`ALTER TABLE "routing_logs" DROP CONSTRAINT "FK_routing_logs_user"`);

    // Drop routing_logs indexes and table
    await queryRunner.query(`DROP INDEX "idx_routing_logs_message"`);
    await queryRunner.query(`DROP INDEX "idx_routing_logs_rule"`);
    await queryRunner.query(`DROP INDEX "idx_routing_logs_scene"`);
    await queryRunner.query(`DROP INDEX "idx_routing_logs_contact"`);
    await queryRunner.query(`DROP INDEX "idx_routing_logs_action"`);
    await queryRunner.query(`DROP INDEX "idx_routing_logs_user_created"`);
    await queryRunner.query(`DROP INDEX "idx_routing_logs_user_id"`);
    await queryRunner.query(`DROP TABLE "routing_logs"`);

    // Drop routing_rules foreign key, indexes and table
    await queryRunner.query(`ALTER TABLE "routing_rules" DROP CONSTRAINT "FK_routing_rules_user"`);
    await queryRunner.query(`DROP INDEX "idx_routing_rules_user_enabled"`);
    await queryRunner.query(`DROP INDEX "idx_routing_rules_user_priority"`);
    await queryRunner.query(`DROP INDEX "idx_routing_rules_user_id"`);
    await queryRunner.query(`DROP TABLE "routing_rules"`);
  }
}
