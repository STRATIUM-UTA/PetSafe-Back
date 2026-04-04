import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakePersonDocumentMandatory1742518800018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query(`
      SELECT COUNT(*)::int AS count
      FROM persons
      WHERE document_id IS NULL
         OR BTRIM(document_id) = ''
    `);

    if (Number(count) > 0) {
      throw new Error(
        `No se puede marcar persons.document_id como obligatorio porque existen ${count} registros sin cédula.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE persons
      ALTER COLUMN document_id SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE persons
      ALTER COLUMN document_id DROP NOT NULL
    `);
  }
}
