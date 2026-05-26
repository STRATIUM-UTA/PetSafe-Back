import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWeightToVaccination1779549121426 implements MigrationInterface {
    name = 'AddWeightToVaccination1779549121426'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patient_vaccine_records" ADD "weight_kg" numeric(8,2)`);
        await queryRunner.query(`ALTER TABLE "encounter_vaccination_drafts" ADD "weight_kg" numeric(8,2)`);
        await queryRunner.query(`ALTER TABLE "vaccination_events" ADD "weight_kg" numeric(8,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vaccination_events" DROP COLUMN "weight_kg"`);
        await queryRunner.query(`ALTER TABLE "encounter_vaccination_drafts" DROP COLUMN "weight_kg"`);
        await queryRunner.query(`ALTER TABLE "patient_vaccine_records" DROP COLUMN "weight_kg"`);
    }
}
