import { MigrationInterface, QueryRunner } from 'typeorm';

export class MobileClientDemoData1777516989322 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            DECLARE
                v_client_person_id INT;
                v_client_user_id INT;
                v_client_id INT;
                v_client_role_id INT;
                v_vet_id INT;
                v_species_perro_id INT;
                v_species_gato_id INT;
                v_breed_labrador_id INT;
                v_breed_persa_id INT;
                v_color_dorado_id INT;
                v_color_gris_id INT;
                v_color_negro_id INT;
                v_patient_1_id INT;
                v_patient_2_id INT;
                v_patient_3_id INT;
                v_enc_1_id INT;
                v_enc_2_id INT;
                v_enc_3_id INT;
                v_vaccine_rabia_perro_id INT;
                v_vaccine_triple_canina_id INT;
                v_vaccine_triple_felina_id INT;
                v_record_1_id INT;
                v_record_2_id INT;
                v_record_3_id INT;
                v_record_4_id INT;
                v_scheme_dog_version_id INT;
                v_scheme_cat_version_id INT;
                v_plan_1_id INT;
                v_plan_2_id INT;
                v_plan_3_id INT;
            BEGIN
                SELECT u.id, u.person_id
                INTO v_client_user_id, v_client_person_id
                FROM users u
                WHERE LOWER(u.email) = LOWER('bjeferssonvinicio2005@gmail.com')
                    AND u.deleted_at IS NULL
                LIMIT 1;

                IF v_client_user_id IS NULL THEN
                    INSERT INTO persons (
                        person_type,
                        first_name,
                        last_name,
                        document_id,
                        phone,
                        address,
                        gender,
                        birth_date,
                        is_active
                    )
                    SELECT
                        'CLIENTE',
                        'Joel',
                        'Bonilla',
                        '0000002005',
                        '0992005000',
                        'Quito, Ecuador',
                        'M',
                        DATE '2005-01-01',
                        true
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM persons p
                        WHERE p.document_id = '0000002005'
                            AND p.deleted_at IS NULL
                    )
                    RETURNING id INTO v_client_person_id;

                    IF v_client_person_id IS NULL THEN
                        SELECT p.id
                        INTO v_client_person_id
                        FROM persons p
                        WHERE p.document_id = '0000002005'
                            AND p.deleted_at IS NULL
                        LIMIT 1;
                    END IF;

                    INSERT INTO users (person_id, email, password_hash, is_active)
                    VALUES (
                        v_client_person_id,
                        'bjeferssonvinicio2005@gmail.com',
                        crypt('Cliente123!', gen_salt('bf', 10)),
                        true
                    )
                    RETURNING id INTO v_client_user_id;
                END IF;

                SELECT c.id
                INTO v_client_id
                FROM clients c
                WHERE c.person_id = v_client_person_id
                    AND c.deleted_at IS NULL
                LIMIT 1;

                IF v_client_id IS NULL THEN
                    INSERT INTO clients (person_id, notes, is_active)
                    VALUES (
                        v_client_person_id,
                        'Cliente demo para app movil y QR de mascotas',
                        true
                    )
                    RETURNING id INTO v_client_id;
                END IF;

                SELECT id INTO v_client_role_id
                FROM roles
                WHERE name = 'CLIENTE_APP'
                    AND deleted_at IS NULL
                LIMIT 1;

                IF v_client_role_id IS NOT NULL THEN
                    INSERT INTO user_roles (user_id, role_id)
                    SELECT v_client_user_id, v_client_role_id
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM user_roles ur
                        WHERE ur.user_id = v_client_user_id
                            AND ur.role_id = v_client_role_id
                    );
                END IF;

                SELECT e.id
                INTO v_vet_id
                FROM employees e
                WHERE e.is_vet = true
                    AND e.deleted_at IS NULL
                ORDER BY e.id
                LIMIT 1;

                IF v_vet_id IS NULL THEN
                    RAISE EXCEPTION 'No existe un empleado veterinario activo para crear consultas demo.';
                END IF;

                SELECT id INTO v_species_perro_id
                FROM species
                WHERE LOWER(name) = LOWER('Perro')
                    AND deleted_at IS NULL
                LIMIT 1;

                SELECT id INTO v_species_gato_id
                FROM species
                WHERE LOWER(name) = LOWER('Gato')
                    AND deleted_at IS NULL
                LIMIT 1;

                IF v_species_perro_id IS NULL OR v_species_gato_id IS NULL THEN
                    RAISE EXCEPTION 'No existen especies base Perro/Gato para datos demo.';
                END IF;

                SELECT id INTO v_breed_labrador_id
                FROM breeds
                WHERE species_id = v_species_perro_id
                    AND LOWER(name) = LOWER('Labrador Retriever')
                    AND deleted_at IS NULL
                LIMIT 1;

                SELECT id INTO v_breed_persa_id
                FROM breeds
                WHERE species_id = v_species_gato_id
                    AND LOWER(name) = LOWER('Persa')
                    AND deleted_at IS NULL
                LIMIT 1;

                SELECT id INTO v_color_dorado_id
                FROM colors
                WHERE LOWER(name) = LOWER('Dorado')
                    AND deleted_at IS NULL
                LIMIT 1;

                SELECT id INTO v_color_gris_id
                FROM colors
                WHERE LOWER(name) = LOWER('Gris')
                    AND deleted_at IS NULL
                LIMIT 1;

                SELECT id INTO v_color_negro_id
                FROM colors
                WHERE LOWER(name) = LOWER('Negro')
                    AND deleted_at IS NULL
                LIMIT 1;

                INSERT INTO patients (
                    code,
                    name,
                    species_id,
                    breed_id,
                    color_id,
                    sex,
                    birth_date,
                    current_weight,
                    is_sterilized,
                    microchip_code,
                    distinguishing_marks,
                    general_allergies,
                    general_history,
                    is_active
                )
                SELECT
                    'DEMO-MOBILE-001',
                    'Max',
                    v_species_perro_id,
                    v_breed_labrador_id,
                    v_color_dorado_id,
                    'MACHO',
                    CURRENT_DATE - INTERVAL '5 years',
                    24.70,
                    true,
                    'DEMO-CHIP-001',
                    'Mancha blanca en pecho',
                    'Sin alergias conocidas',
                    'Paciente demo para app movil',
                    true
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM patients p
                    WHERE p.code = 'DEMO-MOBILE-001'
                        AND p.deleted_at IS NULL
                );

                INSERT INTO patients (
                    code,
                    name,
                    species_id,
                    breed_id,
                    color_id,
                    sex,
                    birth_date,
                    current_weight,
                    is_sterilized,
                    microchip_code,
                    distinguishing_marks,
                    general_allergies,
                    general_history,
                    is_active
                )
                SELECT
                    'DEMO-MOBILE-002',
                    'Luna',
                    v_species_gato_id,
                    v_breed_persa_id,
                    v_color_gris_id,
                    'HEMBRA',
                    CURRENT_DATE - INTERVAL '3 years',
                    4.10,
                    true,
                    'DEMO-CHIP-002',
                    'Pelaje largo con cola esponjosa',
                    'Sensibilidad a alimento de pollo',
                    'Paciente demo para app movil',
                    true
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM patients p
                    WHERE p.code = 'DEMO-MOBILE-002'
                        AND p.deleted_at IS NULL
                );

                INSERT INTO patients (
                    code,
                    name,
                    species_id,
                    breed_id,
                    color_id,
                    sex,
                    birth_date,
                    current_weight,
                    is_sterilized,
                    microchip_code,
                    distinguishing_marks,
                    general_allergies,
                    general_history,
                    is_active
                )
                SELECT
                    'DEMO-MOBILE-003',
                    'Toby',
                    v_species_perro_id,
                    NULL,
                    v_color_negro_id,
                    'MACHO',
                    CURRENT_DATE - INTERVAL '2 years',
                    12.30,
                    false,
                    'DEMO-CHIP-003',
                    'Oreja izquierda semicaida',
                    NULL,
                    'Paciente demo para app movil',
                    true
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM patients p
                    WHERE p.code = 'DEMO-MOBILE-003'
                        AND p.deleted_at IS NULL
                );

                SELECT id INTO v_patient_1_id FROM patients WHERE code = 'DEMO-MOBILE-001' AND deleted_at IS NULL LIMIT 1;
                SELECT id INTO v_patient_2_id FROM patients WHERE code = 'DEMO-MOBILE-002' AND deleted_at IS NULL LIMIT 1;
                SELECT id INTO v_patient_3_id FROM patients WHERE code = 'DEMO-MOBILE-003' AND deleted_at IS NULL LIMIT 1;

                DELETE FROM patient_tutors
                WHERE patient_id IN (v_patient_1_id, v_patient_2_id, v_patient_3_id)
                    AND client_id <> v_client_id;

                INSERT INTO patient_tutors (patient_id, client_id, is_primary, relationship, is_active)
                SELECT v_patient_1_id, v_client_id, true, 'Tutor demo app movil', true
                WHERE v_patient_1_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM patient_tutors pt
                        WHERE pt.patient_id = v_patient_1_id
                            AND pt.client_id = v_client_id
                            AND pt.deleted_at IS NULL
                    );

                INSERT INTO patient_tutors (patient_id, client_id, is_primary, relationship, is_active)
                SELECT v_patient_2_id, v_client_id, true, 'Tutor demo app movil', true
                WHERE v_patient_2_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM patient_tutors pt
                        WHERE pt.patient_id = v_patient_2_id
                            AND pt.client_id = v_client_id
                            AND pt.deleted_at IS NULL
                    );

                INSERT INTO patient_tutors (patient_id, client_id, is_primary, relationship, is_active)
                SELECT v_patient_3_id, v_client_id, true, 'Tutor demo app movil', true
                WHERE v_patient_3_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM patient_tutors pt
                        WHERE pt.patient_id = v_patient_3_id
                            AND pt.client_id = v_client_id
                            AND pt.deleted_at IS NULL
                    );

                INSERT INTO encounters (
                    patient_id,
                    vet_id,
                    start_time,
                    end_time,
                    status,
                    general_notes,
                    created_by_user_id,
                    is_active
                )
                SELECT
                    v_patient_1_id,
                    v_vet_id,
                    date_trunc('minute', now() - INTERVAL '35 days'),
                    date_trunc('minute', now() - INTERVAL '35 days' + INTERVAL '40 minutes'),
                    'FINALIZADA',
                    'DEMO_MOBILE: Consulta control general Max',
                    v_client_user_id,
                    true
                WHERE v_patient_1_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1 FROM encounters e
                        WHERE e.patient_id = v_patient_1_id
                            AND e.general_notes = 'DEMO_MOBILE: Consulta control general Max'
                            AND e.deleted_at IS NULL
                    );

                INSERT INTO encounters (
                    patient_id,
                    vet_id,
                    start_time,
                    end_time,
                    status,
                    general_notes,
                    created_by_user_id,
                    is_active
                )
                SELECT
                    v_patient_2_id,
                    v_vet_id,
                    date_trunc('minute', now() - INTERVAL '22 days'),
                    date_trunc('minute', now() - INTERVAL '22 days' + INTERVAL '35 minutes'),
                    'FINALIZADA',
                    'DEMO_MOBILE: Consulta dermatologica Luna',
                    v_client_user_id,
                    true
                WHERE v_patient_2_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1 FROM encounters e
                        WHERE e.patient_id = v_patient_2_id
                            AND e.general_notes = 'DEMO_MOBILE: Consulta dermatologica Luna'
                            AND e.deleted_at IS NULL
                    );

                INSERT INTO encounters (
                    patient_id,
                    vet_id,
                    start_time,
                    end_time,
                    status,
                    general_notes,
                    created_by_user_id,
                    is_active
                )
                SELECT
                    v_patient_3_id,
                    v_vet_id,
                    date_trunc('minute', now() - INTERVAL '12 days'),
                    date_trunc('minute', now() - INTERVAL '12 days' + INTERVAL '30 minutes'),
                    'FINALIZADA',
                    'DEMO_MOBILE: Consulta digestiva Toby',
                    v_client_user_id,
                    true
                WHERE v_patient_3_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1 FROM encounters e
                        WHERE e.patient_id = v_patient_3_id
                            AND e.general_notes = 'DEMO_MOBILE: Consulta digestiva Toby'
                            AND e.deleted_at IS NULL
                    );

                SELECT id INTO v_enc_1_id
                FROM encounters
                WHERE general_notes = 'DEMO_MOBILE: Consulta control general Max'
                    AND deleted_at IS NULL
                LIMIT 1;

                SELECT id INTO v_enc_2_id
                FROM encounters
                WHERE general_notes = 'DEMO_MOBILE: Consulta dermatologica Luna'
                    AND deleted_at IS NULL
                LIMIT 1;

                SELECT id INTO v_enc_3_id
                FROM encounters
                WHERE general_notes = 'DEMO_MOBILE: Consulta digestiva Toby'
                    AND deleted_at IS NULL
                LIMIT 1;

                INSERT INTO encounter_consultation_reasons (
                    encounter_id,
                    consultation_reason,
                    current_illness_history,
                    is_active
                )
                SELECT
                    v_enc_1_id,
                    'Control anual de salud y revision general',
                    'Paciente estable. Sin signos de alarma.',
                    true
                WHERE v_enc_1_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM encounter_consultation_reasons ecr
                        WHERE ecr.encounter_id = v_enc_1_id
                            AND ecr.deleted_at IS NULL
                    );

                INSERT INTO encounter_consultation_reasons (
                    encounter_id,
                    consultation_reason,
                    current_illness_history,
                    is_active
                )
                SELECT
                    v_enc_2_id,
                    'Prurito y perdida leve de pelo',
                    'Episodio de comezon en ultimas 2 semanas.',
                    true
                WHERE v_enc_2_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM encounter_consultation_reasons ecr
                        WHERE ecr.encounter_id = v_enc_2_id
                            AND ecr.deleted_at IS NULL
                    );

                INSERT INTO encounter_consultation_reasons (
                    encounter_id,
                    consultation_reason,
                    current_illness_history,
                    is_active
                )
                SELECT
                    v_enc_3_id,
                    'Molestia gastrointestinal eventual',
                    'Vomito aislado y mejora con dieta blanda.',
                    true
                WHERE v_enc_3_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM encounter_consultation_reasons ecr
                        WHERE ecr.encounter_id = v_enc_3_id
                            AND ecr.deleted_at IS NULL
                    );

                SELECT v.id
                INTO v_vaccine_rabia_perro_id
                FROM vaccines v
                INNER JOIN species s ON s.id = v.species_id
                WHERE LOWER(s.name) = LOWER('Perro')
                    AND LOWER(v.name) IN (LOWER('Rabia'), LOWER('Antirrábica Canina'))
                    AND v.deleted_at IS NULL
                ORDER BY v.id
                LIMIT 1;

                SELECT v.id
                INTO v_vaccine_triple_canina_id
                FROM vaccines v
                INNER JOIN species s ON s.id = v.species_id
                WHERE LOWER(s.name) = LOWER('Perro')
                    AND LOWER(v.name) = LOWER('Triple Canina')
                    AND v.deleted_at IS NULL
                ORDER BY v.id
                LIMIT 1;

                SELECT v.id
                INTO v_vaccine_triple_felina_id
                FROM vaccines v
                INNER JOIN species s ON s.id = v.species_id
                WHERE LOWER(s.name) = LOWER('Gato')
                    AND LOWER(v.name) IN (LOWER('Triple Felina'), LOWER('Triple felina'))
                    AND v.deleted_at IS NULL
                ORDER BY v.id
                LIMIT 1;

                INSERT INTO patient_vaccine_records (
                    patient_id,
                    vaccine_id,
                    application_date,
                    administered_by,
                    administered_by_employee_id,
                    administered_at,
                    is_external,
                    batch_number,
                    next_dose_date,
                    notes,
                    encounter_id,
                    created_by_user_id,
                    is_active
                )
                SELECT
                    v_patient_1_id,
                    v_vaccine_rabia_perro_id,
                    CURRENT_DATE - INTERVAL '35 days',
                    'Dr. Demo Vet',
                    v_vet_id,
                    'Clinica PetSafe',
                    false,
                    'DEMO-BATCH-001',
                    CURRENT_DATE + INTERVAL '330 days',
                    'DEMO_MOBILE_VAX: Rabia canina Max',
                    v_enc_1_id,
                    v_client_user_id,
                    true
                WHERE v_patient_1_id IS NOT NULL
                    AND v_vaccine_rabia_perro_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM patient_vaccine_records pvr
                        WHERE pvr.notes = 'DEMO_MOBILE_VAX: Rabia canina Max'
                            AND pvr.deleted_at IS NULL
                    );

                INSERT INTO patient_vaccine_records (
                    patient_id,
                    vaccine_id,
                    application_date,
                    administered_by,
                    administered_by_employee_id,
                    administered_at,
                    is_external,
                    batch_number,
                    next_dose_date,
                    notes,
                    encounter_id,
                    created_by_user_id,
                    is_active
                )
                SELECT
                    v_patient_1_id,
                    v_vaccine_triple_canina_id,
                    CURRENT_DATE - INTERVAL '20 days',
                    'Dr. Demo Vet',
                    v_vet_id,
                    'Clinica PetSafe',
                    false,
                    'DEMO-BATCH-002',
                    CURRENT_DATE + INTERVAL '345 days',
                    'DEMO_MOBILE_VAX: Triple canina Max',
                    v_enc_1_id,
                    v_client_user_id,
                    true
                WHERE v_patient_1_id IS NOT NULL
                    AND v_vaccine_triple_canina_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM patient_vaccine_records pvr
                        WHERE pvr.notes = 'DEMO_MOBILE_VAX: Triple canina Max'
                            AND pvr.deleted_at IS NULL
                    );

                INSERT INTO patient_vaccine_records (
                    patient_id,
                    vaccine_id,
                    application_date,
                    administered_by,
                    administered_by_employee_id,
                    administered_at,
                    is_external,
                    batch_number,
                    next_dose_date,
                    notes,
                    encounter_id,
                    created_by_user_id,
                    is_active
                )
                SELECT
                    v_patient_2_id,
                    v_vaccine_triple_felina_id,
                    CURRENT_DATE - INTERVAL '22 days',
                    'Dr. Demo Vet',
                    v_vet_id,
                    'Clinica PetSafe',
                    false,
                    'DEMO-BATCH-003',
                    CURRENT_DATE + INTERVAL '343 days',
                    'DEMO_MOBILE_VAX: Triple felina Luna',
                    v_enc_2_id,
                    v_client_user_id,
                    true
                WHERE v_patient_2_id IS NOT NULL
                    AND v_vaccine_triple_felina_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM patient_vaccine_records pvr
                        WHERE pvr.notes = 'DEMO_MOBILE_VAX: Triple felina Luna'
                            AND pvr.deleted_at IS NULL
                    );

                SELECT id INTO v_record_1_id
                FROM patient_vaccine_records
                WHERE notes = 'DEMO_MOBILE_VAX: Rabia canina Max'
                    AND deleted_at IS NULL
                LIMIT 1;

                SELECT id INTO v_record_2_id
                FROM patient_vaccine_records
                WHERE notes = 'DEMO_MOBILE_VAX: Triple canina Max'
                    AND deleted_at IS NULL
                LIMIT 1;

                SELECT id INTO v_record_3_id
                FROM patient_vaccine_records
                WHERE notes = 'DEMO_MOBILE_VAX: Triple felina Luna'
                    AND deleted_at IS NULL
                LIMIT 1;

                INSERT INTO vaccination_events (
                    encounter_id,
                    vaccine_id,
                    application_date,
                    suggested_next_date,
                    notes,
                    patient_vaccine_record_id,
                    is_active
                )
                SELECT
                    v_enc_1_id,
                    v_vaccine_rabia_perro_id,
                    CURRENT_DATE - INTERVAL '35 days',
                    CURRENT_DATE + INTERVAL '330 days',
                    'DEMO_MOBILE_VAX_EVENT: Rabia canina Max',
                    v_record_1_id,
                    true
                WHERE v_enc_1_id IS NOT NULL
                    AND v_vaccine_rabia_perro_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM vaccination_events ve
                        WHERE ve.notes = 'DEMO_MOBILE_VAX_EVENT: Rabia canina Max'
                            AND ve.deleted_at IS NULL
                    );

                INSERT INTO vaccination_events (
                    encounter_id,
                    vaccine_id,
                    application_date,
                    suggested_next_date,
                    notes,
                    patient_vaccine_record_id,
                    is_active
                )
                SELECT
                    v_enc_1_id,
                    v_vaccine_triple_canina_id,
                    CURRENT_DATE - INTERVAL '20 days',
                    CURRENT_DATE + INTERVAL '345 days',
                    'DEMO_MOBILE_VAX_EVENT: Triple canina Max',
                    v_record_2_id,
                    true
                WHERE v_enc_1_id IS NOT NULL
                    AND v_vaccine_triple_canina_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM vaccination_events ve
                        WHERE ve.notes = 'DEMO_MOBILE_VAX_EVENT: Triple canina Max'
                            AND ve.deleted_at IS NULL
                    );

                INSERT INTO vaccination_events (
                    encounter_id,
                    vaccine_id,
                    application_date,
                    suggested_next_date,
                    notes,
                    patient_vaccine_record_id,
                    is_active
                )
                SELECT
                    v_enc_2_id,
                    v_vaccine_triple_felina_id,
                    CURRENT_DATE - INTERVAL '22 days',
                    CURRENT_DATE + INTERVAL '343 days',
                    'DEMO_MOBILE_VAX_EVENT: Triple felina Luna',
                    v_record_3_id,
                    true
                WHERE v_enc_2_id IS NOT NULL
                    AND v_vaccine_triple_felina_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM vaccination_events ve
                        WHERE ve.notes = 'DEMO_MOBILE_VAX_EVENT: Triple felina Luna'
                            AND ve.deleted_at IS NULL
                    );

                INSERT INTO patient_vaccine_records (
                    patient_id,
                    vaccine_id,
                    application_date,
                    administered_by,
                    administered_by_employee_id,
                    administered_at,
                    is_external,
                    batch_number,
                    next_dose_date,
                    notes,
                    encounter_id,
                    created_by_user_id,
                    is_active
                )
                SELECT
                    v_patient_3_id,
                    v_vaccine_rabia_perro_id,
                    CURRENT_DATE - INTERVAL '12 days',
                    'Dr. Demo Vet',
                    v_vet_id,
                    'Clinica PetSafe',
                    false,
                    'DEMO-BATCH-004',
                    CURRENT_DATE + INTERVAL '353 days',
                    'DEMO_MOBILE_VAX: Rabia canina Toby',
                    v_enc_3_id,
                    v_client_user_id,
                    true
                WHERE v_patient_3_id IS NOT NULL
                    AND v_vaccine_rabia_perro_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM patient_vaccine_records pvr
                        WHERE pvr.notes = 'DEMO_MOBILE_VAX: Rabia canina Toby'
                            AND pvr.deleted_at IS NULL
                    );

                INSERT INTO vaccination_events (
                    encounter_id,
                    vaccine_id,
                    application_date,
                    suggested_next_date,
                    notes,
                    patient_vaccine_record_id,
                    is_active
                )
                SELECT
                    v_enc_3_id,
                    v_vaccine_rabia_perro_id,
                    CURRENT_DATE - INTERVAL '12 days',
                    CURRENT_DATE + INTERVAL '353 days',
                    'DEMO_MOBILE_VAX_EVENT: Rabia canina Toby',
                    NULL,
                    true
                WHERE v_enc_3_id IS NOT NULL
                    AND v_vaccine_rabia_perro_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM vaccination_events ve
                        WHERE ve.notes = 'DEMO_MOBILE_VAX_EVENT: Rabia canina Toby'
                            AND ve.deleted_at IS NULL
                    );

                SELECT id INTO v_record_4_id
                FROM patient_vaccine_records
                WHERE notes = 'DEMO_MOBILE_VAX: Rabia canina Toby'
                    AND deleted_at IS NULL
                LIMIT 1;

                SELECT version.id
                INTO v_scheme_dog_version_id
                FROM vaccination_scheme_versions version
                INNER JOIN vaccination_schemes scheme ON scheme.id = version.scheme_id
                INNER JOIN species s ON s.id = scheme.species_id
                WHERE LOWER(s.name) = LOWER('Perro')
                  AND LOWER(scheme.name) = LOWER('Esquema Canino Inicial')
                  AND version.version = 1
                  AND version.deleted_at IS NULL
                  AND scheme.deleted_at IS NULL
                LIMIT 1;

                SELECT version.id
                INTO v_scheme_cat_version_id
                FROM vaccination_scheme_versions version
                INNER JOIN vaccination_schemes scheme ON scheme.id = version.scheme_id
                INNER JOIN species s ON s.id = scheme.species_id
                WHERE LOWER(s.name) = LOWER('Gato')
                  AND LOWER(scheme.name) = LOWER('Esquema Felino Inicial')
                  AND version.version = 1
                  AND version.deleted_at IS NULL
                  AND scheme.deleted_at IS NULL
                LIMIT 1;

                IF v_scheme_dog_version_id IS NULL OR v_scheme_cat_version_id IS NULL THEN
                    RAISE EXCEPTION 'No se pudieron resolver los esquemas vacunales demo.';
                END IF;

                INSERT INTO patient_vaccination_plans (
                    patient_id,
                    scheme_version_id,
                    status,
                    assigned_at,
                    notes,
                    is_active
                )
                SELECT
                    v_patient_1_id,
                    v_scheme_dog_version_id,
                    'ACTIVO'::patient_vaccination_plan_status_enum,
                    CURRENT_TIMESTAMP,
                    'Plan demo para app movil - Max',
                    true
                WHERE v_patient_1_id IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1
                    FROM patient_vaccination_plans pvp
                    WHERE pvp.patient_id = v_patient_1_id
                      AND pvp.deleted_at IS NULL
                      AND pvp.status = 'ACTIVO'
                  );

                INSERT INTO patient_vaccination_plans (
                    patient_id,
                    scheme_version_id,
                    status,
                    assigned_at,
                    notes,
                    is_active
                )
                SELECT
                    v_patient_2_id,
                    v_scheme_cat_version_id,
                    'ACTIVO'::patient_vaccination_plan_status_enum,
                    CURRENT_TIMESTAMP,
                    'Plan demo para app movil - Luna',
                    true
                WHERE v_patient_2_id IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1
                    FROM patient_vaccination_plans pvp
                    WHERE pvp.patient_id = v_patient_2_id
                      AND pvp.deleted_at IS NULL
                      AND pvp.status = 'ACTIVO'
                  );

                INSERT INTO patient_vaccination_plans (
                    patient_id,
                    scheme_version_id,
                    status,
                    assigned_at,
                    notes,
                    is_active
                )
                SELECT
                    v_patient_3_id,
                    v_scheme_dog_version_id,
                    'ACTIVO'::patient_vaccination_plan_status_enum,
                    CURRENT_TIMESTAMP,
                    'Plan demo para app movil - Toby',
                    true
                WHERE v_patient_3_id IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1
                    FROM patient_vaccination_plans pvp
                    WHERE pvp.patient_id = v_patient_3_id
                      AND pvp.deleted_at IS NULL
                      AND pvp.status = 'ACTIVO'
                  );

                SELECT id INTO v_plan_1_id FROM patient_vaccination_plans WHERE patient_id = v_patient_1_id AND deleted_at IS NULL AND status = 'ACTIVO' ORDER BY id DESC LIMIT 1;
                SELECT id INTO v_plan_2_id FROM patient_vaccination_plans WHERE patient_id = v_patient_2_id AND deleted_at IS NULL AND status = 'ACTIVO' ORDER BY id DESC LIMIT 1;
                SELECT id INTO v_plan_3_id FROM patient_vaccination_plans WHERE patient_id = v_patient_3_id AND deleted_at IS NULL AND status = 'ACTIVO' ORDER BY id DESC LIMIT 1;

                INSERT INTO patient_vaccination_plan_doses (
                    plan_id,
                    scheme_dose_id,
                    vaccine_id,
                    dose_order,
                    status,
                    expected_date,
                    applied_at,
                    application_record_id,
                    notes,
                    is_active
                )
                SELECT
                    v_plan_1_id,
                    sd.id,
                    sd.vaccine_id,
                    sd.dose_order,
                    CASE
                        WHEN pvr.id IS NOT NULL THEN 'APLICADA'::patient_vaccination_plan_dose_status_enum
                        ELSE 'NO_APLICADA'::patient_vaccination_plan_dose_status_enum
                    END,
                    CASE
                        WHEN p.birth_date IS NOT NULL AND sd.age_start_weeks IS NOT NULL THEN (p.birth_date + (sd.age_start_weeks * INTERVAL '7 days'))::date
                        ELSE NULL
                    END,
                    CASE WHEN pvr.id IS NOT NULL THEN pvr.application_date ELSE NULL END,
                    pvr.id,
                    COALESCE(sd.notes, 'Dosis demo para app movil'),
                    true
                FROM vaccination_scheme_versions v
                INNER JOIN vaccination_scheme_version_doses sd ON sd.scheme_version_id = v.id AND sd.deleted_at IS NULL
                INNER JOIN patients p ON p.id = v_patient_1_id AND p.deleted_at IS NULL
                LEFT JOIN patient_vaccine_records pvr ON pvr.patient_id = p.id AND pvr.vaccine_id = sd.vaccine_id AND pvr.deleted_at IS NULL
                WHERE v.id = v_scheme_dog_version_id
                  AND v_plan_1_id IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1
                    FROM patient_vaccination_plan_doses pvd
                    WHERE pvd.plan_id = v_plan_1_id
                      AND pvd.scheme_dose_id = sd.id
                      AND pvd.deleted_at IS NULL
                  );

                                -- Demo user notifications for presentation (consulta aceptada)
                                INSERT INTO user_notifications (
                                        user_id,
                                        title,
                                        body,
                                        reference_type,
                                        reference_id,
                                        is_active
                                )
                                SELECT
                                        v_client_user_id,
                                        'Consulta aceptada',
                                        'DEMO_MOBILE_NOTIFICATION: Consulta aceptada Max. Comentario: Paciente en buen estado, controlar peso en proxima consulta. - Dr. Demo Vet',
                                        'encounter',
                                        v_enc_1_id,
                                        true
                                WHERE v_client_user_id IS NOT NULL
                                    AND v_enc_1_id IS NOT NULL
                                    AND NOT EXISTS (
                                        SELECT 1 FROM user_notifications un
                                        WHERE un.reference_type = 'encounter'
                                            AND un.reference_id = v_enc_1_id
                                            AND un.deleted_at IS NULL
                                    );

                                INSERT INTO user_notifications (
                                        user_id,
                                        title,
                                        body,
                                        reference_type,
                                        reference_id,
                                        is_active
                                )
                                SELECT
                                        v_client_user_id,
                                        'Consulta aceptada',
                                        'DEMO_MOBILE_NOTIFICATION: Consulta aceptada Luna. Comentario: Aplicar shampoo suave y revisar dieta. - Dr. Demo Vet',
                                        'encounter',
                                        v_enc_2_id,
                                        true
                                WHERE v_client_user_id IS NOT NULL
                                    AND v_enc_2_id IS NOT NULL
                                    AND NOT EXISTS (
                                        SELECT 1 FROM user_notifications un
                                        WHERE un.reference_type = 'encounter'
                                            AND un.reference_id = v_enc_2_id
                                            AND un.deleted_at IS NULL
                                    );

                                INSERT INTO user_notifications (
                                        user_id,
                                        title,
                                        body,
                                        reference_type,
                                        reference_id,
                                        is_active
                                )
                                SELECT
                                        v_client_user_id,
                                        'Consulta aceptada',
                                        'DEMO_MOBILE_NOTIFICATION: Consulta aceptada Toby. Comentario: Dieta blanda por 48 horas y revalorar. - Dr. Demo Vet',
                                        'encounter',
                                        v_enc_3_id,
                                        true
                                WHERE v_client_user_id IS NOT NULL
                                    AND v_enc_3_id IS NOT NULL
                                    AND NOT EXISTS (
                                        SELECT 1 FROM user_notifications un
                                        WHERE un.reference_type = 'encounter'
                                            AND un.reference_id = v_enc_3_id
                                            AND un.deleted_at IS NULL
                                    );

                INSERT INTO patient_vaccination_plan_doses (
                    plan_id,
                    scheme_dose_id,
                    vaccine_id,
                    dose_order,
                    status,
                    expected_date,
                    applied_at,
                    application_record_id,
                    notes,
                    is_active
                )
                SELECT
                    v_plan_2_id,
                    sd.id,
                    sd.vaccine_id,
                    sd.dose_order,
                    CASE
                        WHEN pvr.id IS NOT NULL THEN 'APLICADA'::patient_vaccination_plan_dose_status_enum
                        ELSE 'NO_APLICADA'::patient_vaccination_plan_dose_status_enum
                    END,
                    CASE
                        WHEN p.birth_date IS NOT NULL AND sd.age_start_weeks IS NOT NULL THEN (p.birth_date + (sd.age_start_weeks * INTERVAL '7 days'))::date
                        ELSE NULL
                    END,
                    CASE WHEN pvr.id IS NOT NULL THEN pvr.application_date ELSE NULL END,
                    pvr.id,
                    COALESCE(sd.notes, 'Dosis demo para app movil'),
                    true
                FROM vaccination_scheme_versions v
                INNER JOIN vaccination_scheme_version_doses sd ON sd.scheme_version_id = v.id AND sd.deleted_at IS NULL
                INNER JOIN patients p ON p.id = v_patient_2_id AND p.deleted_at IS NULL
                LEFT JOIN patient_vaccine_records pvr ON pvr.patient_id = p.id AND pvr.vaccine_id = sd.vaccine_id AND pvr.deleted_at IS NULL
                WHERE v.id = v_scheme_cat_version_id
                  AND v_plan_2_id IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1
                    FROM patient_vaccination_plan_doses pvd
                    WHERE pvd.plan_id = v_plan_2_id
                      AND pvd.scheme_dose_id = sd.id
                      AND pvd.deleted_at IS NULL
                  );

                INSERT INTO patient_vaccination_plan_doses (
                    plan_id,
                    scheme_dose_id,
                    vaccine_id,
                    dose_order,
                    status,
                    expected_date,
                    applied_at,
                    application_record_id,
                    notes,
                    is_active
                )
                SELECT
                    v_plan_3_id,
                    sd.id,
                    sd.vaccine_id,
                    sd.dose_order,
                    CASE
                        WHEN pvr.id IS NOT NULL THEN 'APLICADA'::patient_vaccination_plan_dose_status_enum
                        ELSE 'NO_APLICADA'::patient_vaccination_plan_dose_status_enum
                    END,
                    CASE
                        WHEN p.birth_date IS NOT NULL AND sd.age_start_weeks IS NOT NULL THEN (p.birth_date + (sd.age_start_weeks * INTERVAL '7 days'))::date
                        ELSE NULL
                    END,
                    CASE WHEN pvr.id IS NOT NULL THEN pvr.application_date ELSE NULL END,
                    pvr.id,
                    COALESCE(sd.notes, 'Dosis demo para app movil'),
                    true
                FROM vaccination_scheme_versions v
                INNER JOIN vaccination_scheme_version_doses sd ON sd.scheme_version_id = v.id AND sd.deleted_at IS NULL
                INNER JOIN patients p ON p.id = v_patient_3_id AND p.deleted_at IS NULL
                LEFT JOIN patient_vaccine_records pvr ON pvr.patient_id = p.id AND pvr.vaccine_id = sd.vaccine_id AND pvr.deleted_at IS NULL
                WHERE v.id = v_scheme_dog_version_id
                  AND v_plan_3_id IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1
                    FROM patient_vaccination_plan_doses pvd
                    WHERE pvd.plan_id = v_plan_3_id
                      AND pvd.scheme_dose_id = sd.id
                      AND pvd.deleted_at IS NULL
                  );
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM user_notifications
            WHERE body LIKE 'DEMO_MOBILE_NOTIFICATION:%'
        `);

        await queryRunner.query(`
            DELETE FROM vaccination_events
            WHERE notes IN (
                'DEMO_MOBILE_VAX_EVENT: Rabia canina Max',
                'DEMO_MOBILE_VAX_EVENT: Triple canina Max',
                'DEMO_MOBILE_VAX_EVENT: Triple felina Luna',
                'DEMO_MOBILE_VAX_EVENT: Rabia canina Toby'
            )
        `);

        await queryRunner.query(`
            DELETE FROM patient_vaccine_records
            WHERE notes IN (
                'DEMO_MOBILE_VAX: Rabia canina Max',
                'DEMO_MOBILE_VAX: Triple canina Max',
                'DEMO_MOBILE_VAX: Triple felina Luna',
                'DEMO_MOBILE_VAX: Rabia canina Toby'
            )
        `);

        await queryRunner.query(`
            DELETE FROM patient_vaccination_plan_doses
            WHERE plan_id IN (
                SELECT id
                FROM patient_vaccination_plans
                WHERE notes IN (
                    'Plan demo para app movil - Max',
                    'Plan demo para app movil - Luna',
                    'Plan demo para app movil - Toby'
                )
            )
        `);

        await queryRunner.query(`
            DELETE FROM patient_vaccination_plans
            WHERE notes IN (
                'Plan demo para app movil - Max',
                'Plan demo para app movil - Luna',
                'Plan demo para app movil - Toby'
            )
        `);

        await queryRunner.query(`
            DELETE FROM encounters
            WHERE general_notes IN (
                'DEMO_MOBILE: Consulta control general Max',
                'DEMO_MOBILE: Consulta dermatologica Luna',
                'DEMO_MOBILE: Consulta digestiva Toby'
            )
        `);

        await queryRunner.query(`
            DELETE FROM patient_tutors
            WHERE patient_id IN (
                SELECT id
                FROM patients
                WHERE code IN ('DEMO-MOBILE-001', 'DEMO-MOBILE-002', 'DEMO-MOBILE-003')
            )
        `);

        await queryRunner.query(`
            DELETE FROM patients
            WHERE code IN ('DEMO-MOBILE-001', 'DEMO-MOBILE-002', 'DEMO-MOBILE-003')
        `);

        await queryRunner.query(`
            DELETE FROM user_roles
            WHERE user_id IN (
                SELECT id
                FROM users
                WHERE LOWER(email) = LOWER('bjeferssonvinicio2005@gmail.com')
            )
        `);

        await queryRunner.query(`
            DELETE FROM clients
            WHERE person_id IN (
                SELECT person_id
                FROM users
                WHERE LOWER(email) = LOWER('bjeferssonvinicio2005@gmail.com')
            )
        `);

        await queryRunner.query(`
            DELETE FROM users
            WHERE LOWER(email) = LOWER('bjeferssonvinicio2005@gmail.com')
        `);

        await queryRunner.query(`
            DELETE FROM persons
            WHERE document_id = '0000002005'
        `);
    }
}
