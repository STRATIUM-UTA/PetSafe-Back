import { MigrationInterface, QueryRunner } from 'typeorm';

export class EncounterActionDrafts1742518800020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vaccination_events
      ADD COLUMN IF NOT EXISTS patient_vaccine_record_id INT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'fk_vaccination_events_patient_vaccine_record'
        ) THEN
          ALTER TABLE vaccination_events
          ADD CONSTRAINT fk_vaccination_events_patient_vaccine_record
          FOREIGN KEY (patient_vaccine_record_id)
          REFERENCES patient_vaccine_records(id)
          ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS encounter_vaccination_drafts (
        id SERIAL PRIMARY KEY,
        encounter_id INT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        plan_dose_id INT NULL REFERENCES patient_vaccination_plan_doses(id) ON DELETE SET NULL,
        vaccine_id INT NOT NULL REFERENCES vaccines(id) ON DELETE RESTRICT,
        application_date DATE NOT NULL,
        suggested_next_date DATE NULL,
        notes TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
        deleted_by_user_id INT NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_encounter_vaccination_drafts_encounter
      ON encounter_vaccination_drafts(encounter_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS encounter_treatment_drafts (
        id SERIAL PRIMARY KEY,
        encounter_id INT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NULL,
        general_instructions TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
        deleted_by_user_id INT NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_encounter_treatment_drafts_encounter
      ON encounter_treatment_drafts(encounter_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS encounter_treatment_draft_items (
        id SERIAL PRIMARY KEY,
        draft_id INT NOT NULL REFERENCES encounter_treatment_drafts(id) ON DELETE CASCADE,
        medication VARCHAR(120) NOT NULL,
        dose VARCHAR(120) NOT NULL,
        frequency VARCHAR(120) NOT NULL,
        duration_days INTEGER NOT NULL,
        administration_route VARCHAR(120) NOT NULL,
        notes TEXT NULL,
        status treatment_item_status_enum NOT NULL DEFAULT 'ACTIVO',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
        deleted_by_user_id INT NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_encounter_treatment_draft_items_draft
      ON encounter_treatment_draft_items(draft_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS encounter_procedure_drafts (
        id SERIAL PRIMARY KEY,
        encounter_id INT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        catalog_id INT NULL REFERENCES procedure_catalog(id) ON DELETE RESTRICT,
        procedure_type VARCHAR(120) NULL,
        performed_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
        description TEXT NULL,
        result TEXT NULL,
        notes TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
        deleted_by_user_id INT NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_encounter_procedure_drafts_encounter
      ON encounter_procedure_drafts(encounter_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_encounter_procedure_drafts_encounter`);
    await queryRunner.query(`DROP TABLE IF EXISTS encounter_procedure_drafts`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_encounter_treatment_draft_items_draft`);
    await queryRunner.query(`DROP TABLE IF EXISTS encounter_treatment_draft_items`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_encounter_treatment_drafts_encounter`);
    await queryRunner.query(`DROP TABLE IF EXISTS encounter_treatment_drafts`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_encounter_vaccination_drafts_encounter`);
    await queryRunner.query(`DROP TABLE IF EXISTS encounter_vaccination_drafts`);

    await queryRunner.query(`
      ALTER TABLE vaccination_events
      DROP CONSTRAINT IF EXISTS fk_vaccination_events_patient_vaccine_record
    `);

    await queryRunner.query(`
      ALTER TABLE vaccination_events
      DROP COLUMN IF EXISTS patient_vaccine_record_id
    `);
  }
}
