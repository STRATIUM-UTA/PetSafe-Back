import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdoptionContactsAndTags1762483200000 implements MigrationInterface {
  name = 'AdoptionContactsAndTags1762483200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "adoptions"
      ADD COLUMN "contact_name" character varying(120),
      ADD COLUMN "contact_phone" character varying(25),
      ADD COLUMN "contact_email" character varying(255)
    `);

    await queryRunner.query(`
      CREATE TABLE "adoption_tags" (
        "id" SERIAL NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "deleted_by_user_id" integer,
        "name" character varying(80) NOT NULL,
        CONSTRAINT "UQ_adoption_tags_name" UNIQUE ("name"),
        CONSTRAINT "PK_adoption_tags_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "adoption_tag_assignments" (
        "adoption_id" integer NOT NULL,
        "tag_id" integer NOT NULL,
        CONSTRAINT "PK_adoption_tag_assignments" PRIMARY KEY ("adoption_id", "tag_id"),
        CONSTRAINT "FK_adoption_tag_assignments_adoption"
          FOREIGN KEY ("adoption_id") REFERENCES "adoptions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_adoption_tag_assignments_tag"
          FOREIGN KEY ("tag_id") REFERENCES "adoption_tags"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_adoption_tag_assignments_adoption_id"
      ON "adoption_tag_assignments" ("adoption_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_adoption_tag_assignments_tag_id"
      ON "adoption_tag_assignments" ("tag_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_adoption_tag_assignments_tag_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_adoption_tag_assignments_adoption_id"`);
    await queryRunner.query(
      `ALTER TABLE "adoption_tag_assignments" DROP CONSTRAINT "FK_adoption_tag_assignments_tag"`,
    );
    await queryRunner.query(
      `ALTER TABLE "adoption_tag_assignments" DROP CONSTRAINT "FK_adoption_tag_assignments_adoption"`,
    );
    await queryRunner.query(`DROP TABLE "adoption_tag_assignments"`);
    await queryRunner.query(`DROP TABLE "adoption_tags"`);
    await queryRunner.query(`
      ALTER TABLE "adoptions"
      DROP COLUMN "contact_email",
      DROP COLUMN "contact_phone",
      DROP COLUMN "contact_name"
    `);
  }
}
