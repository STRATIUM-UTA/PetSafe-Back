import { MigrationInterface, QueryRunner } from 'typeorm';

export class EncounterReactivation1742518800019 implements MigrationInterface {
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum
          WHERE enumlabel = 'REACTIVADA'
            AND enumtypid = 'encounter_status_enum'::regtype
        ) THEN
          ALTER TYPE encounter_status_enum ADD VALUE 'REACTIVADA';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE encounters
      DROP CONSTRAINT IF EXISTS ck_encounters_status_end
    `);

    await queryRunner.query(`
      ALTER TABLE encounters
      ADD CONSTRAINT ck_encounters_status_end CHECK (
        ((status IN ('ACTIVA', 'REACTIVADA')) AND end_time IS NULL) OR
        (status IN ('FINALIZADA', 'ANULADA'))
      )
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS uq_encounter_active_by_patient_live`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_encounter_active_by_queue_live`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_encounter_active_by_patient_live
      ON encounters(patient_id)
      WHERE deleted_at IS NULL AND status IN ('ACTIVA', 'REACTIVADA')
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_encounter_active_by_queue_live
      ON encounters(queue_entry_id)
      WHERE queue_entry_id IS NOT NULL AND deleted_at IS NULL AND status IN ('ACTIVA', 'REACTIVADA')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_encounter_active_by_patient_live`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_encounter_active_by_queue_live`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_encounter_active_by_patient_live
      ON encounters(patient_id)
      WHERE deleted_at IS NULL AND status = 'ACTIVA'
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_encounter_active_by_queue_live
      ON encounters(queue_entry_id)
      WHERE queue_entry_id IS NOT NULL AND deleted_at IS NULL AND status = 'ACTIVA'
    `);

    await queryRunner.query(`
      ALTER TABLE encounters
      DROP CONSTRAINT IF EXISTS ck_encounters_status_end
    `);

    await queryRunner.query(`
      ALTER TABLE encounters
      ADD CONSTRAINT ck_encounters_status_end CHECK (
        (status = 'ACTIVA' AND end_time IS NULL) OR
        (status IN ('FINALIZADA', 'ANULADA'))
      )
    `);
  }
}
