import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppointmentEndTime1742518800101 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS end_time time without time zone
    `);

    await queryRunner.query(`
      UPDATE appointments
      SET end_time = CASE
        WHEN scheduled_time > TIME '23:29' THEN TIME '23:59:59'
        ELSE (scheduled_time + INTERVAL '30 minutes')::time
      END
      WHERE end_time IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE appointments
      ALTER COLUMN end_time SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE appointments
      DROP CONSTRAINT IF EXISTS ck_appointments_time_range
    `);

    await queryRunner.query(`
      ALTER TABLE appointments
      ADD CONSTRAINT ck_appointments_time_range
      CHECK (end_time > scheduled_time)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_vet_date_time_range
      ON appointments(vet_id, scheduled_date, scheduled_time, end_time)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_appointments_vet_date_time_range`);
    await queryRunner.query(`ALTER TABLE appointments DROP CONSTRAINT IF EXISTS ck_appointments_time_range`);
    await queryRunner.query(`ALTER TABLE appointments DROP COLUMN IF EXISTS end_time`);
  }
}
