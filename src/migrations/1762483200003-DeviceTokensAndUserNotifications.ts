import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeviceTokensAndUserNotifications1762483200003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id                  SERIAL PRIMARY KEY,
        is_active           BOOLEAN NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at          TIMESTAMP WITHOUT TIME ZONE,
        deleted_by_user_id  INTEGER,
        user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        fcm_token           VARCHAR(512) NOT NULL,
        platform            VARCHAR(20) NOT NULL DEFAULT 'android'
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id                  SERIAL PRIMARY KEY,
        is_active           BOOLEAN NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at          TIMESTAMP WITHOUT TIME ZONE,
        deleted_by_user_id  INTEGER,
        user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title               VARCHAR(200) NOT NULL,
        body                TEXT NOT NULL,
        reference_type      VARCHAR(60),
        reference_id        INTEGER,
        read_at             TIMESTAMP WITHOUT TIME ZONE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_id)
      WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_notifications`);
    await queryRunner.query(`DROP TABLE IF EXISTS device_tokens`);
  }
}
