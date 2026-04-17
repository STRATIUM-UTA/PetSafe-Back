import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalHistoryReportSeed1742518800018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        v_vet_person_id INT;
        v_vet_user_id INT;
        v_vet_employee_id INT;
        v_tutor1_person_id INT;
        v_tutor1_user_id INT;
        v_tutor1_client_id INT;
        v_tutor2_person_id INT;
        v_tutor2_user_id INT;
        v_tutor2_client_id INT;
        v_species_id INT;
        v_breed_id INT;
        v_color_id INT;
        v_patient_id INT;
        v_encounter_1_id INT;
        v_encounter_2_id INT;
        v_treatment_1_id INT;
        v_treatment_2_id INT;
        v_vaccine_1_id INT;
        v_vaccine_2_id INT;
        v_surgery_catalog_1_id INT;
        v_surgery_catalog_2_id INT;
        v_created_by_user_id INT;
        v_role_id INT;
      BEGIN
        SELECT id INTO v_role_id FROM roles WHERE name = 'MVZ' AND deleted_at IS NULL LIMIT 1;

        SELECT id INTO v_vet_person_id
        FROM persons
        WHERE document_id = 'CH-REPORT-VET-001' AND deleted_at IS NULL
        LIMIT 1;

        IF v_vet_person_id IS NULL THEN
          INSERT INTO persons (
            person_type, first_name, last_name, document_id, phone, address, gender, is_active
          )
          VALUES (
            'EMPLEADO', 'Lucia', 'Veterinaria', 'CH-REPORT-VET-001', '0991111111',
            'Clinica PetSafe', 'F', true
          )
          RETURNING id INTO v_vet_person_id;
        END IF;

        SELECT id INTO v_vet_user_id
        FROM users
        WHERE email = 'clinical-history.vet@safepet.com' AND deleted_at IS NULL
        LIMIT 1;

        IF v_vet_user_id IS NULL THEN
          INSERT INTO users (person_id, email, password_hash, is_active)
          VALUES (
            v_vet_person_id,
            'clinical-history.vet@safepet.com',
            crypt('VetClinical123!', gen_salt('bf', 10)),
            true
          )
          RETURNING id INTO v_vet_user_id;
        END IF;

        SELECT id INTO v_vet_employee_id
        FROM employees
        WHERE person_id = v_vet_person_id AND deleted_at IS NULL
        LIMIT 1;

        IF v_vet_employee_id IS NULL THEN
          INSERT INTO employees (
            person_id, code, job_title, professional_license, is_vet, hire_date, is_active
          )
          VALUES (
            v_vet_person_id, 'EMP-CH-001', 'Medico Veterinario',
            'VET-CH-001', true, CURRENT_DATE - INTERVAL '180 days', true
          )
          RETURNING id INTO v_vet_employee_id;
        END IF;

        IF v_role_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM user_roles WHERE user_id = v_vet_user_id AND role_id = v_role_id
        ) THEN
          INSERT INTO user_roles (user_id, role_id) VALUES (v_vet_user_id, v_role_id);
        END IF;

        v_created_by_user_id := v_vet_user_id;

        SELECT id INTO v_tutor1_person_id
        FROM persons
        WHERE document_id = 'CH-REPORT-TUTOR-001' AND deleted_at IS NULL
        LIMIT 1;

        IF v_tutor1_person_id IS NULL THEN
          INSERT INTO persons (
            person_type, first_name, last_name, document_id, phone, address, gender, is_active
          )
          VALUES (
            'CLIENTE', 'Andrea', 'Lopez', 'CH-REPORT-TUTOR-001', '0992222221',
            'Tutor principal de prueba', 'F', true
          )
          RETURNING id INTO v_tutor1_person_id;
        END IF;

        SELECT id INTO v_tutor1_user_id
        FROM users
        WHERE email = 'clinical-history.tutor1@safepet.com' AND deleted_at IS NULL
        LIMIT 1;

        IF v_tutor1_user_id IS NULL THEN
          INSERT INTO users (person_id, email, password_hash, is_active)
          VALUES (
            v_tutor1_person_id,
            'clinical-history.tutor1@safepet.com',
            crypt('TutorClinical123!', gen_salt('bf', 10)),
            true
          )
          RETURNING id INTO v_tutor1_user_id;
        END IF;

        SELECT id INTO v_tutor1_client_id
        FROM clients
        WHERE person_id = v_tutor1_person_id AND deleted_at IS NULL
        LIMIT 1;

        IF v_tutor1_client_id IS NULL THEN
          INSERT INTO clients (person_id, notes, is_active)
          VALUES (v_tutor1_person_id, 'Tutor principal para pruebas de historial clinico', true)
          RETURNING id INTO v_tutor1_client_id;
        END IF;

        SELECT id INTO v_tutor2_person_id
        FROM persons
        WHERE document_id = 'CH-REPORT-TUTOR-002' AND deleted_at IS NULL
        LIMIT 1;

        IF v_tutor2_person_id IS NULL THEN
          INSERT INTO persons (
            person_type, first_name, last_name, document_id, phone, address, gender, is_active
          )
          VALUES (
            'CLIENTE', 'Carlos', 'Mendez', 'CH-REPORT-TUTOR-002', '0992222222',
            'Tutor secundario de prueba', 'M', true
          )
          RETURNING id INTO v_tutor2_person_id;
        END IF;

        SELECT id INTO v_tutor2_user_id
        FROM users
        WHERE email = 'clinical-history.tutor2@safepet.com' AND deleted_at IS NULL
        LIMIT 1;

        IF v_tutor2_user_id IS NULL THEN
          INSERT INTO users (person_id, email, password_hash, is_active)
          VALUES (
            v_tutor2_person_id,
            'clinical-history.tutor2@safepet.com',
            crypt('TutorClinical123!', gen_salt('bf', 10)),
            true
          )
          RETURNING id INTO v_tutor2_user_id;
        END IF;

        SELECT id INTO v_tutor2_client_id
        FROM clients
        WHERE person_id = v_tutor2_person_id AND deleted_at IS NULL
        LIMIT 1;

        IF v_tutor2_client_id IS NULL THEN
          INSERT INTO clients (person_id, notes, is_active)
          VALUES (v_tutor2_person_id, 'Tutor secundario para pruebas de historial clinico', true)
          RETURNING id INTO v_tutor2_client_id;
        END IF;

        SELECT id INTO v_species_id
        FROM species
        WHERE LOWER(name) = LOWER('Perro') AND deleted_at IS NULL
        LIMIT 1;

        IF v_species_id IS NULL THEN
          RAISE EXCEPTION 'No existe la especie Perro para el seed de historial clinico';
        END IF;

        SELECT id INTO v_breed_id
        FROM breeds
        WHERE species_id = v_species_id AND LOWER(name) = LOWER('Labrador Retriever') AND deleted_at IS NULL
        LIMIT 1;

        IF v_breed_id IS NULL THEN
          INSERT INTO breeds (species_id, name, description, is_active)
          VALUES (v_species_id, 'Labrador Retriever', 'Raza de prueba para historial clinico', true)
          RETURNING id INTO v_breed_id;
        END IF;

        SELECT id INTO v_color_id
        FROM colors
        WHERE LOWER(name) = LOWER('Dorado') AND deleted_at IS NULL
        LIMIT 1;

        IF v_color_id IS NULL THEN
          INSERT INTO colors (name, is_active)
          VALUES ('Dorado', true)
          RETURNING id INTO v_color_id;
        END IF;

        SELECT id INTO v_patient_id
        FROM patients
        WHERE code = 'PET-CH-001' AND deleted_at IS NULL
        LIMIT 1;

        IF v_patient_id IS NULL THEN
          INSERT INTO patients (
            code, name, species_id, breed_id, color_id, sex, birth_date, current_weight,
            is_sterilized, microchip_code, distinguishing_marks, general_history, is_active
          )
          VALUES (
            'PET-CH-001', 'Max', v_species_id, v_breed_id, v_color_id, 'MACHO',
            DATE '2021-06-15', 28.40, true, 'MC-CH-001',
            'Mancha blanca en el pecho',
            'Paciente de prueba para validar el PDF de historial clinico.',
            true
          )
          RETURNING id INTO v_patient_id;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM patient_tutors
          WHERE patient_id = v_patient_id AND client_id = v_tutor1_client_id
        ) THEN
          INSERT INTO patient_tutors (
            patient_id, client_id, is_primary, relationship, is_active
          )
          VALUES (
            v_patient_id, v_tutor1_client_id, true, 'Propietaria', true
          );
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM patient_tutors
          WHERE patient_id = v_patient_id AND client_id = v_tutor2_client_id
        ) THEN
          INSERT INTO patient_tutors (
            patient_id, client_id, is_primary, relationship, is_active
          )
          VALUES (
            v_patient_id, v_tutor2_client_id, false, 'Responsable secundario', true
          );
        END IF;

        SELECT id INTO v_encounter_1_id
        FROM encounters
        WHERE patient_id = v_patient_id
          AND start_time = TIMESTAMP '2026-03-01 09:00:00'
          AND deleted_at IS NULL
        LIMIT 1;

        IF v_encounter_1_id IS NULL THEN
          INSERT INTO encounters (
            patient_id, vet_id, start_time, end_time, status, general_notes,
            created_by_user_id, is_active
          )
          VALUES (
            v_patient_id, v_vet_employee_id, TIMESTAMP '2026-03-01 09:00:00',
            TIMESTAMP '2026-03-01 09:45:00', 'FINALIZADA',
            'Consulta inicial con plan terapeutico y vacunacion.',
            v_created_by_user_id, true
          )
          RETURNING id INTO v_encounter_1_id;
        END IF;

        SELECT id INTO v_encounter_2_id
        FROM encounters
        WHERE patient_id = v_patient_id
          AND start_time = TIMESTAMP '2026-03-20 15:30:00'
          AND deleted_at IS NULL
        LIMIT 1;

        IF v_encounter_2_id IS NULL THEN
          INSERT INTO encounters (
            patient_id, vet_id, start_time, end_time, status, general_notes,
            created_by_user_id, is_active
          )
          VALUES (
            v_patient_id, v_vet_employee_id, TIMESTAMP '2026-03-20 15:30:00',
            TIMESTAMP '2026-03-20 16:20:00', 'FINALIZADA',
            'Control posterior y evaluacion prequirurgica.',
            v_created_by_user_id, true
          )
          RETURNING id INTO v_encounter_2_id;
        END IF;

        SELECT id INTO v_treatment_1_id
        FROM treatments
        WHERE encounter_id = v_encounter_1_id
          AND start_date = DATE '2026-03-01'
          AND deleted_at IS NULL
        LIMIT 1;

        IF v_treatment_1_id IS NULL THEN
          INSERT INTO treatments (
            encounter_id, status, start_date, end_date, general_instructions, is_active
          )
          VALUES (
            v_encounter_1_id, 'FINALIZADO', DATE '2026-03-01', DATE '2026-03-10',
            'Administrar medicacion despues de comer y controlar apetito.', true
          )
          RETURNING id INTO v_treatment_1_id;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM treatment_items
          WHERE treatment_id = v_treatment_1_id AND medication = 'Amoxicilina'
            AND deleted_at IS NULL
        ) THEN
          INSERT INTO treatment_items (
            treatment_id, medication, dose, frequency, duration_days,
            administration_route, notes, status, is_active
          )
          VALUES (
            v_treatment_1_id, 'Amoxicilina', '500 mg', 'Cada 12 horas', 7,
            'Oral', 'Completar el esquema completo.', 'FINALIZADO', true
          );
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM treatment_items
          WHERE treatment_id = v_treatment_1_id AND medication = 'Carprofeno'
            AND deleted_at IS NULL
        ) THEN
          INSERT INTO treatment_items (
            treatment_id, medication, dose, frequency, duration_days,
            administration_route, notes, status, is_active
          )
          VALUES (
            v_treatment_1_id, 'Carprofeno', '75 mg', 'Cada 24 horas', 5,
            'Oral', 'Suspender si hay vomito o diarrea.', 'FINALIZADO', true
          );
        END IF;

        SELECT id INTO v_treatment_2_id
        FROM treatments
        WHERE encounter_id = v_encounter_2_id
          AND start_date = DATE '2026-03-20'
          AND deleted_at IS NULL
        LIMIT 1;

        IF v_treatment_2_id IS NULL THEN
          INSERT INTO treatments (
            encounter_id, status, start_date, end_date, general_instructions, is_active
          )
          VALUES (
            v_encounter_2_id, 'ACTIVO', DATE '2026-03-20', DATE '2026-03-30',
            'Mantener reposo relativo y usar collar isabelino si se lame la zona.', true
          )
          RETURNING id INTO v_treatment_2_id;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM treatment_items
          WHERE treatment_id = v_treatment_2_id AND medication = 'Cefalexina'
            AND deleted_at IS NULL
        ) THEN
          INSERT INTO treatment_items (
            treatment_id, medication, dose, frequency, duration_days,
            administration_route, notes, status, is_active
          )
          VALUES (
            v_treatment_2_id, 'Cefalexina', '600 mg', 'Cada 12 horas', 10,
            'Oral', 'Tratamiento preventivo post operatorio.', 'ACTIVO', true
          );
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM treatment_items
          WHERE treatment_id = v_treatment_2_id AND medication = 'Meloxicam'
            AND deleted_at IS NULL
        ) THEN
          INSERT INTO treatment_items (
            treatment_id, medication, dose, frequency, duration_days,
            administration_route, notes, status, is_active
          )
          VALUES (
            v_treatment_2_id, 'Meloxicam', '2 ml', 'Cada 24 horas', 4,
            'Oral', 'Administrar con alimento.', 'ACTIVO', true
          );
        END IF;

        SELECT id INTO v_vaccine_1_id
        FROM vaccines
        WHERE species_id = v_species_id AND deleted_at IS NULL
        ORDER BY dose_order NULLS LAST, id
        LIMIT 1;

        SELECT id INTO v_vaccine_2_id
        FROM vaccines
        WHERE species_id = v_species_id
          AND deleted_at IS NULL
          AND id <> COALESCE(v_vaccine_1_id, -1)
        ORDER BY dose_order NULLS LAST, id
        LIMIT 1;

        IF v_vaccine_1_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM patient_vaccine_records
          WHERE patient_id = v_patient_id
            AND vaccine_id = v_vaccine_1_id
            AND application_date = DATE '2026-03-01'
            AND deleted_at IS NULL
        ) THEN
          INSERT INTO patient_vaccine_records (
            patient_id, vaccine_id, application_date, administered_by, administered_at,
            is_external, batch_number, next_dose_date, notes, encounter_id,
            created_by_user_id, is_active
          )
          VALUES (
            v_patient_id, v_vaccine_1_id, DATE '2026-03-01', 'Dra. Lucia Veterinaria',
            'Consulta interna - sala 1', false, 'LOT-CH-001', DATE '2026-04-01',
            'Vacuna aplicada durante consulta general.', v_encounter_1_id,
            v_created_by_user_id, true
          );
        END IF;

        IF v_vaccine_2_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM patient_vaccine_records
          WHERE patient_id = v_patient_id
            AND vaccine_id = v_vaccine_2_id
            AND application_date = DATE '2025-11-15'
            AND deleted_at IS NULL
        ) THEN
          INSERT INTO patient_vaccine_records (
            patient_id, vaccine_id, application_date, administered_by, administered_at,
            is_external, batch_number, next_dose_date, notes, encounter_id,
            created_by_user_id, is_active
          )
          VALUES (
            v_patient_id, v_vaccine_2_id, DATE '2025-11-15', 'Dr. Externo',
            'Clinica veterinaria externa', true, 'LOT-CH-EXT-01', DATE '2026-11-15',
            'Registro historico migrado para pruebas del carnet vacunal.', NULL,
            v_created_by_user_id, true
          );
        END IF;

        IF v_vaccine_1_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM vaccination_events
          WHERE encounter_id = v_encounter_1_id
            AND vaccine_id = v_vaccine_1_id
            AND application_date = DATE '2026-03-01'
            AND deleted_at IS NULL
        ) THEN
          INSERT INTO vaccination_events (
            encounter_id, vaccine_id, application_date, suggested_next_date, notes, is_active
          )
          VALUES (
            v_encounter_1_id, v_vaccine_1_id, DATE '2026-03-01', DATE '2026-04-01',
            'Evento de vacunacion interno para pruebas del historial clinico.', true
          );
        END IF;

        SELECT id INTO v_surgery_catalog_1_id
        FROM surgery_catalog
        WHERE LOWER(name) LIKE LOWER('Profilaxis Dental%')
          AND deleted_at IS NULL
        LIMIT 1;

        SELECT id INTO v_surgery_catalog_2_id
        FROM surgery_catalog
        WHERE LOWER(name) LIKE LOWER('Orquiectomia%')
           OR LOWER(name) LIKE LOWER('Orquiectomía%')
          AND deleted_at IS NULL
        LIMIT 1;

        IF NOT EXISTS (
          SELECT 1 FROM surgeries
          WHERE encounter_id = v_encounter_1_id
            AND surgery_type = 'Profilaxis dental'
            AND deleted_at IS NULL
        ) THEN
          INSERT INTO surgeries (
            encounter_id, surgery_type, scheduled_date, performed_date, surgery_status,
            description, postoperative_instructions, is_active, catalog_id
          )
          VALUES (
            v_encounter_1_id, 'Profilaxis dental', TIMESTAMP '2026-03-05 08:00:00',
            TIMESTAMP '2026-03-05 08:45:00', 'FINALIZADA',
            'Limpieza dental completa con retiro de calculo moderado.',
            'Ofrecer alimento blando por 24 horas y vigilar sangrado leve.',
            true, v_surgery_catalog_1_id
          );
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM surgeries
          WHERE encounter_id = v_encounter_2_id
            AND surgery_type = 'Orquiectomia programada'
            AND deleted_at IS NULL
        ) THEN
          INSERT INTO surgeries (
            encounter_id, surgery_type, scheduled_date, performed_date, surgery_status,
            description, postoperative_instructions, is_active, catalog_id
          )
          VALUES (
            v_encounter_2_id, 'Orquiectomia programada', TIMESTAMP '2026-03-25 10:00:00',
            TIMESTAMP '2026-03-25 10:50:00', 'FINALIZADA',
            'Cirugia electiva sin complicaciones intraoperatorias.',
            'Reposo por 7 dias, limpieza local diaria y control en 72 horas.',
            true, v_surgery_catalog_2_id
          );
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM vaccination_events
      WHERE encounter_id IN (
        SELECT id FROM encounters WHERE patient_id IN (
          SELECT id FROM patients WHERE code = 'PET-CH-001'
        )
      )
    `);

    await queryRunner.query(`
      DELETE FROM patient_vaccine_records
      WHERE patient_id IN (
        SELECT id FROM patients WHERE code = 'PET-CH-001'
      )
    `);

    await queryRunner.query(`
      DELETE FROM treatment_items
      WHERE treatment_id IN (
        SELECT t.id
        FROM treatments t
        INNER JOIN encounters e ON e.id = t.encounter_id
        INNER JOIN patients p ON p.id = e.patient_id
        WHERE p.code = 'PET-CH-001'
      )
    `);

    await queryRunner.query(`
      DELETE FROM surgeries
      WHERE encounter_id IN (
        SELECT e.id
        FROM encounters e
        INNER JOIN patients p ON p.id = e.patient_id
        WHERE p.code = 'PET-CH-001'
      )
    `);

    await queryRunner.query(`
      DELETE FROM treatments
      WHERE encounter_id IN (
        SELECT e.id
        FROM encounters e
        INNER JOIN patients p ON p.id = e.patient_id
        WHERE p.code = 'PET-CH-001'
      )
    `);

    await queryRunner.query(`
      DELETE FROM encounters
      WHERE patient_id IN (
        SELECT id FROM patients WHERE code = 'PET-CH-001'
      )
    `);

    await queryRunner.query(`
      DELETE FROM patient_tutors
      WHERE patient_id IN (
        SELECT id FROM patients WHERE code = 'PET-CH-001'
      )
    `);

    await queryRunner.query(`
      DELETE FROM patients
      WHERE code = 'PET-CH-001'
    `);

    await queryRunner.query(`
      DELETE FROM user_roles
      WHERE user_id IN (
        SELECT id FROM users
        WHERE email IN (
          'clinical-history.vet@safepet.com',
          'clinical-history.tutor1@safepet.com',
          'clinical-history.tutor2@safepet.com'
        )
      )
    `);

    await queryRunner.query(`
      DELETE FROM employees
      WHERE code = 'EMP-CH-001'
    `);

    await queryRunner.query(`
      DELETE FROM clients
      WHERE person_id IN (
        SELECT id FROM persons
        WHERE document_id IN ('CH-REPORT-TUTOR-001', 'CH-REPORT-TUTOR-002')
      )
    `);

    await queryRunner.query(`
      DELETE FROM users
      WHERE email IN (
        'clinical-history.vet@safepet.com',
        'clinical-history.tutor1@safepet.com',
        'clinical-history.tutor2@safepet.com'
      )
    `);

    await queryRunner.query(`
      DELETE FROM persons
      WHERE document_id IN (
        'CH-REPORT-VET-001',
        'CH-REPORT-TUTOR-001',
        'CH-REPORT-TUTOR-002'
      )
    `);

    await queryRunner.query(`
      DELETE FROM breeds
      WHERE name = 'Labrador Retriever'
        AND description = 'Raza de prueba para historial clinico'
    `);
  }
}
