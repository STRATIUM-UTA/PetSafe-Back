import { MigrationInterface, QueryRunner } from 'typeorm';

export class PatientSurgeryHistory1742518800021 implements MigrationInterface {
  name = 'PatientSurgeryHistory1742518800021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE surgeries
      ADD COLUMN IF NOT EXISTS patient_id int
    `);

    await queryRunner.query(`
      ALTER TABLE surgeries
      ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      UPDATE surgeries AS surgery
      SET patient_id = encounter.patient_id
      FROM encounters AS encounter
      WHERE surgery.encounter_id = encounter.id
        AND surgery.patient_id IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE surgeries
      ALTER COLUMN patient_id SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE surgeries
      DROP CONSTRAINT IF EXISTS fk_surgeries_encounter
    `);

    await queryRunner.query(`
      ALTER TABLE surgeries
      ALTER COLUMN encounter_id DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE surgeries
      ADD CONSTRAINT fk_surgeries_encounter
      FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE surgeries
      ADD CONSTRAINT fk_surgeries_patient
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE surgeries
      ADD CONSTRAINT ck_surgeries_source
      CHECK (
        (is_external = true AND encounter_id IS NULL)
        OR
        (is_external = false AND encounter_id IS NOT NULL)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_surgeries_patient_id
      ON surgeries(patient_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_surgeries_external
      ON surgeries(is_external)
      WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_surgeries_external
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_surgeries_patient_id
    `);

    await queryRunner.query(`
      ALTER TABLE surgeries
      DROP CONSTRAINT IF EXISTS ck_surgeries_source
    `);

    await queryRunner.query(`
      ALTER TABLE surgeries
      DROP CONSTRAINT IF EXISTS fk_surgeries_patient
    `);

    await queryRunner.query(`
      DELETE FROM surgeries
      WHERE encounter_id IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE surgeries
      DROP CONSTRAINT IF EXISTS fk_surgeries_encounter
    `);

    await queryRunner.query(`
      ALTER TABLE surgeries
      ALTER COLUMN encounter_id SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE surgeries
      ADD CONSTRAINT fk_surgeries_encounter
      FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE surgeries
      DROP COLUMN IF EXISTS is_external
    `);

    await queryRunner.query(`
      ALTER TABLE surgeries
      DROP COLUMN IF EXISTS patient_id
    `);
  }
}
