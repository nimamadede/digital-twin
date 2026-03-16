import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrective migration for P0-03:
 * - Synchronize data between duplicated camelCase / snake_case columns.
 * - Keep schema non-destructive for now (no DROP COLUMN), so it is safe to run
 *   on existing databases while we gradually refactor entities and follow-up migrations.
 *
 * NOTE:
 * - This migration does NOT change table/column definitions, only copies data so that
 *   snake_case columns (used by foreign keys) are never behind camelCase columns.
 * - Structural cleanup (dropping duplicate columns, renaming indexes, etc.) should be
 *   handled in a dedicated follow-up migration once entities are updated accordingly.
 */
export class AddMissingTables1775000000000 implements MigrationInterface {
  name = 'AddMissingTables1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // style_profiles: userId / user_id
    await queryRunner.query(`
      UPDATE "style_profiles"
      SET "user_id" = COALESCE("user_id", "userId")
    `);

    // scene_modes: userId / user_id, profileId / profile_id
    await queryRunner.query(`
      UPDATE "scene_modes"
      SET
        "user_id" = COALESCE("user_id", "userId"),
        "profile_id" = COALESCE("profile_id", "profileId")
    `);

    // user_settings: userId / user_id, defaultSceneId / default_scene_id, defaultProfileId / default_profile_id
    await queryRunner.query(`
      UPDATE "user_settings"
      SET
        "user_id" = COALESCE("user_id", "userId"),
        "default_scene_id" = COALESCE("default_scene_id", "defaultSceneId"),
        "default_profile_id" = COALESCE("default_profile_id", "defaultProfileId")
    `);

    // file_uploads: userId / user_id
    await queryRunner.query(`
      UPDATE "file_uploads"
      SET "user_id" = COALESCE("user_id", "userId")
    `);

    // style_tasks: userId / user_id, profileId / profile_id, fileId / file_id
    await queryRunner.query(`
      UPDATE "style_tasks"
      SET
        "user_id" = COALESCE("user_id", "userId"),
        "profile_id" = COALESCE("profile_id", "profileId"),
        "file_id" = COALESCE("file_id", "fileId")
    `);

    // style_samples: profileId / profile_id
    await queryRunner.query(`
      UPDATE "style_samples"
      SET "profile_id" = COALESCE("profile_id", "profileId")
    `);

    // contacts: userId / user_id, customReplyProfileId / custom_reply_profile_id
    await queryRunner.query(`
      UPDATE "contacts"
      SET
        "user_id" = COALESCE("user_id", "userId"),
        "custom_reply_profile_id" = COALESCE("custom_reply_profile_id", "customReplyProfileId")
    `);

    // reply_records: userId / user_id, contactId / contact_id, profileId / profile_id, sceneId / scene_id, incomingMessageId / incoming_message_id
    await queryRunner.query(`
      UPDATE "reply_records"
      SET
        "user_id" = COALESCE("user_id", "userId"),
        "contact_id" = COALESCE("contact_id", "contactId"),
        "profile_id" = COALESCE("profile_id", "profileId"),
        "scene_id" = COALESCE("scene_id", "sceneId"),
        "incoming_message_id" = COALESCE("incoming_message_id", "incomingMessageId")
    `);

    // platform_auths: userId / user_id
    await queryRunner.query(`
      UPDATE "platform_auths"
      SET "user_id" = COALESCE("user_id", "userId")
    `);

    // notifications: userId / user_id
    await queryRunner.query(`
      UPDATE "notifications"
      SET "user_id" = COALESCE("user_id", "userId")
    `);

    // messages: userId / user_id, contactId / contact_id, replyRecordId / reply_record_id
    await queryRunner.query(`
      UPDATE "messages"
      SET
        "user_id" = COALESCE("user_id", "userId"),
        "contact_id" = COALESCE("contact_id", "contactId"),
        "reply_record_id" = COALESCE("reply_record_id", "replyRecordId")
    `);

    // audit_logs: userId / user_id
    await queryRunner.query(`
      UPDATE "audit_logs"
      SET "user_id" = COALESCE("user_id", "userId")
    `);

    // message_export_tasks: userId / user_id, fileUploadId / file_upload_id
    await queryRunner.query(`
      UPDATE "message_export_tasks"
      SET
        "user_id" = COALESCE("user_id", "userId"),
        "file_upload_id" = COALESCE("file_upload_id", "fileUploadId")
    `);

    // routing_rules: userId / user_id
    await queryRunner.query(`
      UPDATE "routing_rules"
      SET "user_id" = COALESCE("user_id", "userId")
    `);

    // routing_logs: userId / user_id, messageId / message_id, contactId / contact_id,
    //               matchedRuleId / matched_rule_id, sceneId / scene_id,
    //               profileId / profile_id, replyRecordId / reply_record_id
    await queryRunner.query(`
      UPDATE "routing_logs"
      SET
        "user_id" = COALESCE("user_id", "userId"),
        "message_id" = COALESCE("message_id", "messageId"),
        "contact_id" = COALESCE("contact_id", "contactId"),
        "matched_rule_id" = COALESCE("matched_rule_id", "matchedRuleId"),
        "scene_id" = COALESCE("scene_id", "sceneId"),
        "profile_id" = COALESCE("profile_id", "profileId"),
        "reply_record_id" = COALESCE("reply_record_id", "replyRecordId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Down migration is intentionally a no-op:
    // we only propagated data from camelCase to snake_case columns,
    // which is safe and idempotent. Reversing this automatically
    // could lead to unexpected overwrites, so we skip it here.
    return;
  }
}

