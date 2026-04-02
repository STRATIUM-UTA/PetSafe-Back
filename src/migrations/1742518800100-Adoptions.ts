import { MigrationInterface, QueryRunner } from 'typeorm';

export class Adoptions1742518800100 implements MigrationInterface {
  name = 'Adoptions1742518800100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."adoption_status_enum" AS ENUM('DISPONIBLE', 'EN_PROCESO', 'ADOPTADO', 'CANCELADO')
    `);
    
    await queryRunner.query(`
      CREATE TABLE "adoptions" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "deleted_by_user_id" integer,
        "patient_id" integer NOT NULL,
        "status" "public"."adoption_status_enum" NOT NULL DEFAULT 'DISPONIBLE',
        "story" text,
        "requirements" text,
        "adopter_client_id" integer,
        "adoption_date" date,
        "notes" text,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_adoptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_adoptions_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_adoptions_client" FOREIGN KEY ("adopter_client_id") REFERENCES "clients"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "adoptions" DROP CONSTRAINT "FK_adoptions_client"`);
    await queryRunner.query(`ALTER TABLE "adoptions" DROP CONSTRAINT "FK_adoptions_patient"`);
    await queryRunner.query(`DROP TABLE "adoptions"`);
    await queryRunner.query(`DROP TYPE "public"."adoption_status_enum"`);
  }
}
