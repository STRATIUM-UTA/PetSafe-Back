import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordResetNotifications1742518800012
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS usuarios_password_reset_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id uuid NOT NULL,
        code_hash varchar(255) NOT NULL,
        channel varchar(30) NOT NULL DEFAULT 'email',
        destination varchar(255) NOT NULL,
        expires_at timestamp without time zone NOT NULL,
        used_at timestamp without time zone,
        invalidated_at timestamp without time zone,
        attempts integer NOT NULL DEFAULT 0,
        max_attempts integer NOT NULL DEFAULT 5,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        CONSTRAINT fk_password_reset_tokens_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_usuario_created
      ON usuarios_password_reset_tokens (usuario_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
      ON usuarios_password_reset_tokens (expires_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_password_reset_tokens_expires_at
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_password_reset_tokens_usuario_created
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS usuarios_password_reset_tokens CASCADE
    `);
  }
}
