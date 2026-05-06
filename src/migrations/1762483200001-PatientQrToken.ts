import { MigrationInterface, QueryRunner } from 'typeorm';

export class PatientQrToken1762483200001 implements MigrationInterface {
  name = 'PatientQrToken1762483200001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patients"
      ADD COLUMN "qr_token" uuid DEFAULT gen_random_uuid()
    `);

    await queryRunner.query(`
      UPDATE "patients" SET "qr_token" = gen_random_uuid() WHERE "qr_token" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "patients"
      ALTER COLUMN "qr_token" SET NOT NULL,
      ADD CONSTRAINT "UQ_patients_qr_token" UNIQUE ("qr_token")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "UQ_patients_qr_token"`);
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "qr_token"`);
  }
}
