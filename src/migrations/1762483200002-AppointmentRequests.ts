import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppointmentRequests1762483200002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE appointment_request_status_enum AS ENUM (
        'PENDIENTE',
        'CONFIRMADA',
        'RECHAZADA',
        'CANCELADA'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE appointment_requests (
        id                    SERIAL PRIMARY KEY,
        is_active             BOOLEAN NOT NULL DEFAULT TRUE,
        created_at            TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at            TIMESTAMP WITHOUT TIME ZONE,
        deleted_by_user_id    INTEGER,
        client_user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        patient_id            INTEGER REFERENCES patients(id) ON DELETE SET NULL,
        reason                TEXT NOT NULL,
        preferred_date        DATE,
        preferred_time        TIME WITHOUT TIME ZONE,
        status                appointment_request_status_enum NOT NULL DEFAULT 'PENDIENTE',
        staff_notes           TEXT,
        reviewed_by_user_id   INTEGER
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_appointment_requests_client ON appointment_requests(client_user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_appointment_requests_status ON appointment_requests(status) WHERE deleted_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS appointment_requests`);
    await queryRunner.query(`DROP TYPE IF EXISTS appointment_request_status_enum`);
  }
}
