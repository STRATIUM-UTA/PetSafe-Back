import { MigrationInterface, QueryRunner } from 'typeorm';

export class ZootecnicalGroupsAndSpeciesTaxonomy1742518800013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS zootecnical_groups (
        id SERIAL PRIMARY KEY,
        name varchar(100) NOT NULL,
        description varchar(255),
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        updated_at timestamp without time zone NOT NULL DEFAULT now(),
        deleted_at timestamp without time zone,
        deleted_by_user_id int
      )
    `);

    await queryRunner.query(`
      ALTER TABLE species
      ADD COLUMN IF NOT EXISTS zootecnical_group_id int
    `);

    await queryRunner.query(`
      INSERT INTO zootecnical_groups (name, description, is_active)
      SELECT 'Otros', 'Grupo zootécnico genérico para especies no clasificadas', true
      WHERE NOT EXISTS (
        SELECT 1 FROM zootecnical_groups WHERE LOWER(name) = LOWER('Otros')
      )
    `);

    await queryRunner.query(`
      UPDATE species
      SET zootecnical_group_id = (
        SELECT id FROM zootecnical_groups WHERE LOWER(name) = LOWER('Otros') LIMIT 1
      )
      WHERE zootecnical_group_id IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE species
      ALTER COLUMN zootecnical_group_id SET NOT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_species_zootecnical_group'
            AND table_name = 'species'
        ) THEN
          ALTER TABLE species
          ADD CONSTRAINT fk_species_zootecnical_group
          FOREIGN KEY (zootecnical_group_id) REFERENCES zootecnical_groups(id) ON DELETE RESTRICT;
        END IF;
      END $$;
    `);

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE species DROP CONSTRAINT IF EXISTS fk_species_zootecnical_group`);
    await queryRunner.query(`ALTER TABLE species DROP COLUMN IF EXISTS zootecnical_group_id`);

    await queryRunner.query(`DROP TABLE IF EXISTS zootecnical_groups CASCADE`);
  }
}
