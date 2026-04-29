import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalCasesAndFollowUps1742518800102 implements MigrationInterface {
  name = 'ClinicalCasesAndFollowUps1742518800102';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clinical_case_status_enum') THEN
          CREATE TYPE clinical_case_status_enum AS ENUM ('ABIERTO', 'CERRADO', 'CANCELADO');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clinical_case_follow_up_status_enum') THEN
          CREATE TYPE clinical_case_follow_up_status_enum AS ENUM ('PROGRAMADO', 'EN_ATENCION', 'COMPLETADO', 'CANCELADO');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'encounter_follow_up_action_enum') THEN
          CREATE TYPE encounter_follow_up_action_enum AS ENUM ('NONE', 'KEEP_OPEN', 'SCHEDULE_CONTROL', 'RESOLVE', 'CANCEL');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'treatment_evolution_event_type_enum') THEN
          CREATE TYPE treatment_evolution_event_type_enum AS ENUM ('CONTINUA', 'SUSPENDE', 'FINALIZA', 'REEMPLAZA');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE appointments
      ALTER COLUMN scheduled_time SET NOT NULL
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
      CREATE TABLE IF NOT EXISTS clinical_cases (
        id SERIAL PRIMARY KEY,
        patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        origin_encounter_id INT NOT NULL REFERENCES encounters(id) ON DELETE RESTRICT,
        status clinical_case_status_enum NOT NULL DEFAULT 'ABIERTO',
        problem_summary VARCHAR(240) NOT NULL,
        problem_summary_normalized VARCHAR(240) NOT NULL,
        opened_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        closed_at TIMESTAMP WITHOUT TIME ZONE NULL,
        canceled_at TIMESTAMP WITHOUT TIME ZONE NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
        deleted_by_user_id INT NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clinical_cases_patient_id
      ON clinical_cases(patient_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clinical_cases_status
      ON clinical_cases(status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clinical_cases_problem_summary_normalized
      ON clinical_cases(patient_id, problem_summary_normalized)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS clinical_case_follow_ups (
        id SERIAL PRIMARY KEY,
        clinical_case_id INT NOT NULL REFERENCES clinical_cases(id) ON DELETE CASCADE,
        source_encounter_id INT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        generated_appointment_id INT NULL REFERENCES appointments(id) ON DELETE SET NULL,
        target_encounter_id INT NULL REFERENCES encounters(id) ON DELETE SET NULL,
        suggested_date DATE NOT NULL,
        status clinical_case_follow_up_status_enum NOT NULL DEFAULT 'PROGRAMADO',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
        deleted_by_user_id INT NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clinical_case_follow_ups_case
      ON clinical_case_follow_ups(clinical_case_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clinical_case_follow_ups_source_encounter
      ON clinical_case_follow_ups(source_encounter_id)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_clinical_case_follow_ups_generated_appointment_live
      ON clinical_case_follow_ups(generated_appointment_id)
      WHERE generated_appointment_id IS NOT NULL AND deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_clinical_case_follow_ups_target_encounter_live
      ON clinical_case_follow_ups(target_encounter_id)
      WHERE target_encounter_id IS NOT NULL AND deleted_at IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE encounters
      ADD COLUMN IF NOT EXISTS clinical_case_id INT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_encounters_clinical_case'
        ) THEN
          ALTER TABLE encounters
          ADD CONSTRAINT fk_encounters_clinical_case
          FOREIGN KEY (clinical_case_id) REFERENCES clinical_cases(id) ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_encounters_clinical_case_id
      ON encounters(clinical_case_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS encounter_follow_up_configs (
        encounter_id INT PRIMARY KEY REFERENCES encounters(id) ON DELETE CASCADE,
        action encounter_follow_up_action_enum NOT NULL DEFAULT 'NONE',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
        deleted_by_user_id INT NULL
      )
    `);

    await queryRunner.query(`
      ALTER TABLE treatments
      ADD COLUMN IF NOT EXISTS clinical_case_id INT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE treatments
      ADD COLUMN IF NOT EXISTS closed_by_encounter_id INT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE treatments
      ADD COLUMN IF NOT EXISTS replaces_treatment_id INT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_treatments_clinical_case'
        ) THEN
          ALTER TABLE treatments
          ADD CONSTRAINT fk_treatments_clinical_case
          FOREIGN KEY (clinical_case_id) REFERENCES clinical_cases(id) ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_treatments_closed_by_encounter'
        ) THEN
          ALTER TABLE treatments
          ADD CONSTRAINT fk_treatments_closed_by_encounter
          FOREIGN KEY (closed_by_encounter_id) REFERENCES encounters(id) ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_treatments_replaces_treatment'
        ) THEN
          ALTER TABLE treatments
          ADD CONSTRAINT fk_treatments_replaces_treatment
          FOREIGN KEY (replaces_treatment_id) REFERENCES treatments(id) ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_treatments_clinical_case_id
      ON treatments(clinical_case_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_treatments_closed_by_encounter_id
      ON treatments(closed_by_encounter_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_treatments_replaces_treatment_id
      ON treatments(replaces_treatment_id)
    `);

    await queryRunner.query(`
      ALTER TABLE encounter_treatment_drafts
      ADD COLUMN IF NOT EXISTS replaces_treatment_id INT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_encounter_treatment_drafts_replaces_treatment'
        ) THEN
          ALTER TABLE encounter_treatment_drafts
          ADD CONSTRAINT fk_encounter_treatment_drafts_replaces_treatment
          FOREIGN KEY (replaces_treatment_id) REFERENCES treatments(id) ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS encounter_treatment_review_drafts (
        id SERIAL PRIMARY KEY,
        encounter_id INT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        source_treatment_id INT NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
        action treatment_evolution_event_type_enum NOT NULL,
        notes TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
        deleted_by_user_id INT NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_encounter_treatment_review_drafts_encounter
      ON encounter_treatment_review_drafts(encounter_id)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_encounter_treatment_review_drafts_source_live
      ON encounter_treatment_review_drafts(encounter_id, source_treatment_id)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS treatment_evolution_events (
        id SERIAL PRIMARY KEY,
        treatment_id INT NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
        encounter_id INT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        clinical_case_id INT NOT NULL REFERENCES clinical_cases(id) ON DELETE CASCADE,
        event_type treatment_evolution_event_type_enum NOT NULL,
        notes TEXT NULL,
        replacement_treatment_id INT NULL REFERENCES treatments(id) ON DELETE SET NULL,
        previous_status treatment_status_enum NULL,
        previous_end_date DATE NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
        deleted_by_user_id INT NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_treatment_evolution_events_case
      ON treatment_evolution_events(clinical_case_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_treatment_evolution_events_encounter
      ON treatment_evolution_events(encounter_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_treatment_evolution_events_encounter`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_treatment_evolution_events_case`);
    await queryRunner.query(`DROP TABLE IF EXISTS treatment_evolution_events`);

    await queryRunner.query(`DROP INDEX IF EXISTS uq_encounter_treatment_review_drafts_source_live`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_encounter_treatment_review_drafts_encounter`);
    await queryRunner.query(`DROP TABLE IF EXISTS encounter_treatment_review_drafts`);

    await queryRunner.query(`
      ALTER TABLE encounter_treatment_drafts
      DROP CONSTRAINT IF EXISTS fk_encounter_treatment_drafts_replaces_treatment
    `);

    await queryRunner.query(`
      ALTER TABLE encounter_treatment_drafts
      DROP COLUMN IF EXISTS replaces_treatment_id
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_treatments_replaces_treatment_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_treatments_closed_by_encounter_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_treatments_clinical_case_id`);

    await queryRunner.query(`
      ALTER TABLE treatments
      DROP CONSTRAINT IF EXISTS fk_treatments_replaces_treatment
    `);

    await queryRunner.query(`
      ALTER TABLE treatments
      DROP CONSTRAINT IF EXISTS fk_treatments_closed_by_encounter
    `);

    await queryRunner.query(`
      ALTER TABLE treatments
      DROP CONSTRAINT IF EXISTS fk_treatments_clinical_case
    `);

    await queryRunner.query(`
      ALTER TABLE treatments
      DROP COLUMN IF EXISTS replaces_treatment_id
    `);

    await queryRunner.query(`
      ALTER TABLE treatments
      DROP COLUMN IF EXISTS closed_by_encounter_id
    `);

    await queryRunner.query(`
      ALTER TABLE treatments
      DROP COLUMN IF EXISTS clinical_case_id
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS encounter_follow_up_configs`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_encounters_clinical_case_id`);
    await queryRunner.query(`ALTER TABLE encounters DROP CONSTRAINT IF EXISTS fk_encounters_clinical_case`);
    await queryRunner.query(`ALTER TABLE encounters DROP COLUMN IF EXISTS clinical_case_id`);

    await queryRunner.query(`DROP INDEX IF EXISTS uq_clinical_case_follow_ups_target_encounter_live`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_clinical_case_follow_ups_generated_appointment_live`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_clinical_case_follow_ups_source_encounter`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_clinical_case_follow_ups_case`);
    await queryRunner.query(`DROP TABLE IF EXISTS clinical_case_follow_ups`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_clinical_cases_problem_summary_normalized`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_clinical_cases_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_clinical_cases_patient_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS clinical_cases`);

    await queryRunner.query(`DROP TYPE IF EXISTS encounter_follow_up_action_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS treatment_evolution_event_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS clinical_case_follow_up_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS clinical_case_status_enum`);
  }
}
