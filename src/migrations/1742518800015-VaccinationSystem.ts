import { MigrationInterface, QueryRunner } from 'typeorm';

export class VaccinationSystem1742518800015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vaccination_scheme_version_status_enum') THEN
          CREATE TYPE vaccination_scheme_version_status_enum AS ENUM ('VIGENTE', 'REEMPLAZADO', 'SUSPENDIDO');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_vaccination_plan_status_enum') THEN
          CREATE TYPE patient_vaccination_plan_status_enum AS ENUM ('ACTIVO', 'CERRADO', 'REEMPLAZADO');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_vaccination_plan_dose_status_enum') THEN
          CREATE TYPE patient_vaccination_plan_dose_status_enum AS ENUM ('APLICADA', 'DESCONOCIDA', 'NO_APLICADA', 'BLOQUEADA', 'REQUIERE_REVISION');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS patient_vaccine_records (
        id serial PRIMARY KEY,
        patient_id int NOT NULL,
        vaccine_id int NOT NULL,
        application_date date NOT NULL,
        administered_by varchar(120),
        administered_by_employee_id int,
        administered_at varchar(180),
        is_external boolean NOT NULL DEFAULT false,
        batch_number varchar(80),
        next_dose_date date,
        notes text,
        encounter_id int,
        created_by_user_id int,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        updated_at timestamp without time zone NOT NULL DEFAULT now(),
        deleted_at timestamp without time zone,
        deleted_by_user_id int,
        CONSTRAINT fk_pvr_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
        CONSTRAINT fk_pvr_vaccine FOREIGN KEY (vaccine_id) REFERENCES vaccines(id) ON DELETE RESTRICT,
        CONSTRAINT fk_pvr_encounter FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL,
        CONSTRAINT fk_pvr_administered_by_employee FOREIGN KEY (administered_by_employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
        CONSTRAINT fk_pvr_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_pvr_deleted_by FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT ck_pvr_next_dose CHECK (next_dose_date IS NULL OR next_dose_date >= application_date)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vaccination_schemes (
        id serial PRIMARY KEY,
        name varchar(120) NOT NULL,
        description text,
        species_id int NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        updated_at timestamp without time zone NOT NULL DEFAULT now(),
        deleted_at timestamp without time zone,
        deleted_by_user_id int,
        CONSTRAINT fk_vaccination_schemes_species FOREIGN KEY (species_id) REFERENCES species(id) ON DELETE RESTRICT,
        CONSTRAINT fk_vaccination_schemes_deleted_by FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vaccination_scheme_versions (
        id serial PRIMARY KEY,
        scheme_id int NOT NULL,
        version int NOT NULL,
        status vaccination_scheme_version_status_enum NOT NULL DEFAULT 'VIGENTE',
        valid_from date NOT NULL,
        valid_to date,
        change_reason text,
        revaccination_rule varchar(120),
        general_interval_days int,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        updated_at timestamp without time zone NOT NULL DEFAULT now(),
        deleted_at timestamp without time zone,
        deleted_by_user_id int,
        CONSTRAINT fk_vaccination_scheme_versions_scheme FOREIGN KEY (scheme_id) REFERENCES vaccination_schemes(id) ON DELETE CASCADE,
        CONSTRAINT fk_vaccination_scheme_versions_deleted_by FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vaccination_scheme_version_doses (
        id serial PRIMARY KEY,
        scheme_version_id int NOT NULL,
        vaccine_id int NOT NULL,
        dose_order int NOT NULL,
        age_start_weeks int,
        age_end_weeks int,
        interval_days int,
        is_required boolean NOT NULL DEFAULT true,
        notes text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        updated_at timestamp without time zone NOT NULL DEFAULT now(),
        deleted_at timestamp without time zone,
        deleted_by_user_id int,
        CONSTRAINT fk_vaccination_scheme_version_doses_version FOREIGN KEY (scheme_version_id) REFERENCES vaccination_scheme_versions(id) ON DELETE CASCADE,
        CONSTRAINT fk_vaccination_scheme_version_doses_vaccine FOREIGN KEY (vaccine_id) REFERENCES vaccines(id) ON DELETE RESTRICT,
        CONSTRAINT fk_vaccination_scheme_version_doses_deleted_by FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS patient_vaccination_plans (
        id serial PRIMARY KEY,
        patient_id int NOT NULL,
        scheme_version_id int NOT NULL,
        status patient_vaccination_plan_status_enum NOT NULL DEFAULT 'ACTIVO',
        assigned_at timestamp without time zone NOT NULL DEFAULT now(),
        notes text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        updated_at timestamp without time zone NOT NULL DEFAULT now(),
        deleted_at timestamp without time zone,
        deleted_by_user_id int,
        CONSTRAINT fk_patient_vaccination_plans_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        CONSTRAINT fk_patient_vaccination_plans_version FOREIGN KEY (scheme_version_id) REFERENCES vaccination_scheme_versions(id) ON DELETE RESTRICT,
        CONSTRAINT fk_patient_vaccination_plans_deleted_by FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS patient_vaccination_plan_doses (
        id serial PRIMARY KEY,
        plan_id int NOT NULL,
        scheme_dose_id int NOT NULL,
        vaccine_id int NOT NULL,
        dose_order int NOT NULL,
        status patient_vaccination_plan_dose_status_enum NOT NULL DEFAULT 'NO_APLICADA',
        expected_date date,
        applied_at date,
        application_record_id int,
        notes text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        updated_at timestamp without time zone NOT NULL DEFAULT now(),
        deleted_at timestamp without time zone,
        deleted_by_user_id int,
        CONSTRAINT fk_patient_vaccination_plan_doses_plan FOREIGN KEY (plan_id) REFERENCES patient_vaccination_plans(id) ON DELETE CASCADE,
        CONSTRAINT fk_patient_vaccination_plan_doses_scheme_dose FOREIGN KEY (scheme_dose_id) REFERENCES vaccination_scheme_version_doses(id) ON DELETE RESTRICT,
        CONSTRAINT fk_patient_vaccination_plan_doses_vaccine FOREIGN KEY (vaccine_id) REFERENCES vaccines(id) ON DELETE RESTRICT,
        CONSTRAINT fk_patient_vaccination_plan_doses_application FOREIGN KEY (application_record_id) REFERENCES patient_vaccine_records(id) ON DELETE SET NULL,
        CONSTRAINT fk_patient_vaccination_plan_doses_deleted_by FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pvr_patient_id ON patient_vaccine_records(patient_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pvr_vaccine_id ON patient_vaccine_records(vaccine_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pvr_encounter_id ON patient_vaccine_records(encounter_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pvr_administered_by_employee_id ON patient_vaccine_records(administered_by_employee_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pvr_deleted_at ON patient_vaccine_records(deleted_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_vaccines_species_id ON vaccines(species_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_vaccination_schemes_species_id ON vaccination_schemes(species_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_vaccination_scheme_versions_scheme_id ON vaccination_scheme_versions(scheme_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_vaccination_scheme_version_doses_version_id ON vaccination_scheme_version_doses(scheme_version_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_patient_vaccination_plans_patient_id ON patient_vaccination_plans(patient_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_patient_vaccination_plan_doses_plan_id ON patient_vaccination_plan_doses(plan_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_patient_vaccination_plan_doses_vaccine_id ON patient_vaccination_plan_doses(vaccine_id)`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_vaccination_scheme_versions_scheme_version_live
      ON vaccination_scheme_versions (scheme_id, version)
      WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_vaccination_scheme_versions_one_active
      ON vaccination_scheme_versions (scheme_id)
      WHERE deleted_at IS NULL AND status = 'VIGENTE'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_vaccination_scheme_version_doses_order_live
      ON vaccination_scheme_version_doses (scheme_version_id, dose_order)
      WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_vaccination_plans_active
      ON patient_vaccination_plans (patient_id)
      WHERE deleted_at IS NULL AND status = 'ACTIVO'
    `);

    await queryRunner.query(`
      INSERT INTO vaccines (name, species_id, is_revaccination, is_mandatory, dose_order, is_active)
      SELECT data.name, s.id, data.is_revaccination, false, NULL, true
      FROM (
        VALUES
          ('Bivalente', 'Perro', false),
          ('Cuádruple', 'Perro', false),
          ('Múltiple', 'Perro', false),
          ('Bordetella', 'Perro', false),
          ('Rabia', 'Perro', false),
          ('Triple felina', 'Gato', false),
          ('Refuerzo', 'Gato', false),
          ('Leucemia felina', 'Gato', false),
          ('Rabia', 'Gato', false)
      ) AS data(name, species_name, is_revaccination)
      INNER JOIN species s ON LOWER(s.name) = LOWER(data.species_name)
      WHERE NOT EXISTS (
        SELECT 1 FROM vaccines v WHERE LOWER(v.name) = LOWER(data.name) AND v.species_id = s.id AND v.deleted_at IS NULL
      )
    `);

    await queryRunner.query(`
      INSERT INTO vaccination_schemes (name, description, species_id, is_active)
      SELECT data.name, data.description, s.id, true
      FROM (
        VALUES
          ('Esquema Canino Inicial', 'Esquema base canino versionado del sistema', 'Perro'),
          ('Esquema Felino Inicial', 'Esquema base felino versionado del sistema', 'Gato')
      ) AS data(name, description, species_name)
      INNER JOIN species s ON LOWER(s.name) = LOWER(data.species_name)
      WHERE NOT EXISTS (
        SELECT 1 FROM vaccination_schemes vs WHERE LOWER(vs.name) = LOWER(data.name) AND vs.species_id = s.id AND vs.deleted_at IS NULL
      )
    `);

    await queryRunner.query(`
      INSERT INTO vaccination_scheme_versions (
        scheme_id,
        version,
        status,
        valid_from,
        valid_to,
        change_reason,
        revaccination_rule,
        general_interval_days,
        is_active
      )
      SELECT scheme.id, 1, 'VIGENTE', CURRENT_DATE, NULL, 'Versión inicial del protocolo clínico', data.revaccination_rule, data.general_interval_days, true
      FROM (
        VALUES
          ('Esquema Canino Inicial', 'Perro', 'ANUAL', 21),
          ('Esquema Felino Inicial', 'Gato', 'BIANUAL', 30)
      ) AS data(name, species_name, revaccination_rule, general_interval_days)
      INNER JOIN species s ON LOWER(s.name) = LOWER(data.species_name)
      INNER JOIN vaccination_schemes scheme ON LOWER(scheme.name) = LOWER(data.name) AND scheme.species_id = s.id AND scheme.deleted_at IS NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM vaccination_scheme_versions version WHERE version.scheme_id = scheme.id AND version.version = 1 AND version.deleted_at IS NULL
      )
    `);

    await queryRunner.query(`
      INSERT INTO vaccination_scheme_version_doses (
        scheme_version_id,
        vaccine_id,
        dose_order,
        age_start_weeks,
        age_end_weeks,
        interval_days,
        is_required,
        notes,
        is_active
      )
      SELECT version.id, vaccine.id, data.dose_order, data.age_start_weeks, data.age_end_weeks, data.interval_days, true, data.notes, true
      FROM (
        VALUES
          ('Esquema Canino Inicial', 'Perro', 1, 'Bivalente', 6, 8, 21, 'Primera dosis canina'),
          ('Esquema Canino Inicial', 'Perro', 2, 'Cuádruple', 8, 10, 21, 'Segunda dosis canina'),
          ('Esquema Canino Inicial', 'Perro', 3, 'Múltiple', 12, 16, 21, 'Tercera dosis canina'),
          ('Esquema Canino Inicial', 'Perro', 4, 'Bordetella', 16, 20, 21, 'Cuarta dosis canina'),
          ('Esquema Canino Inicial', 'Perro', 5, 'Rabia', 16, 24, 21, 'Cierre del esquema canino'),
          ('Esquema Felino Inicial', 'Gato', 1, 'Triple felina', 8, 9, 30, 'Primera dosis felina'),
          ('Esquema Felino Inicial', 'Gato', 2, 'Refuerzo', 9, 10, 30, 'Segunda dosis felina'),
          ('Esquema Felino Inicial', 'Gato', 3, 'Leucemia felina', 12, 16, 30, 'Tercera dosis felina'),
          ('Esquema Felino Inicial', 'Gato', 4, 'Rabia', 16, 24, 30, 'Cierre del esquema felino')
      ) AS data(scheme_name, species_name, dose_order, vaccine_name, age_start_weeks, age_end_weeks, interval_days, notes)
      INNER JOIN species s ON LOWER(s.name) = LOWER(data.species_name)
      INNER JOIN vaccination_schemes scheme ON LOWER(scheme.name) = LOWER(data.scheme_name) AND scheme.species_id = s.id AND scheme.deleted_at IS NULL
      INNER JOIN vaccination_scheme_versions version ON version.scheme_id = scheme.id AND version.version = 1 AND version.deleted_at IS NULL
      INNER JOIN vaccines vaccine ON LOWER(vaccine.name) = LOWER(data.vaccine_name) AND vaccine.species_id = s.id AND vaccine.deleted_at IS NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM vaccination_scheme_version_doses dose WHERE dose.scheme_version_id = version.id AND dose.dose_order = data.dose_order AND dose.deleted_at IS NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_patient_vaccination_plans_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_vaccination_scheme_version_doses_order_live`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_vaccination_scheme_versions_one_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_vaccination_scheme_versions_scheme_version_live`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patient_vaccination_plan_doses_vaccine_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patient_vaccination_plan_doses_plan_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patient_vaccination_plans_patient_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_vaccination_scheme_version_doses_version_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_vaccination_scheme_versions_scheme_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_vaccination_schemes_species_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_vaccines_species_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pvr_deleted_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pvr_administered_by_employee_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pvr_encounter_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pvr_vaccine_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pvr_patient_id`);

    await queryRunner.query(`
      DELETE FROM vaccination_scheme_version_doses
      WHERE scheme_version_id IN (
        SELECT version.id
        FROM vaccination_scheme_versions version
        INNER JOIN vaccination_schemes scheme ON scheme.id = version.scheme_id
        WHERE LOWER(scheme.name) IN ('esquema canino inicial', 'esquema felino inicial')
      )
    `);
    await queryRunner.query(`
      DELETE FROM vaccination_scheme_versions
      WHERE scheme_id IN (
        SELECT id FROM vaccination_schemes WHERE LOWER(name) IN ('esquema canino inicial', 'esquema felino inicial')
      )
    `);
    await queryRunner.query(`
      DELETE FROM vaccination_schemes
      WHERE LOWER(name) IN ('esquema canino inicial', 'esquema felino inicial')
    `);
    await queryRunner.query(`
      DELETE FROM vaccines
      WHERE (LOWER(name), species_id) IN (
        SELECT LOWER(data.name), s.id
        FROM (
          VALUES
            ('Bivalente', 'Perro'),
            ('Cuádruple', 'Perro'),
            ('Múltiple', 'Perro'),
            ('Bordetella', 'Perro'),
            ('Rabia', 'Perro'),
            ('Triple felina', 'Gato'),
            ('Refuerzo', 'Gato'),
            ('Leucemia felina', 'Gato'),
            ('Rabia', 'Gato')
        ) AS data(name, species_name)
        INNER JOIN species s ON LOWER(s.name) = LOWER(data.species_name)
      )
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS patient_vaccination_plan_doses CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS patient_vaccination_plans CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS vaccination_scheme_version_doses CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS vaccination_scheme_versions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS vaccination_schemes CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS patient_vaccine_records CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS patient_vaccination_plan_dose_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS patient_vaccination_plan_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS vaccination_scheme_version_status_enum`);
  }
}
