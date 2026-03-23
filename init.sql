CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN
        CREATE TYPE gender_enum AS ENUM ('F', 'M', 'OTRO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'person_type_enum') THEN
        CREATE TYPE person_type_enum AS ENUM ('EMPLEADO', 'CLIENTE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_sex_enum') THEN
        CREATE TYPE patient_sex_enum AS ENUM ('MACHO', 'HEMBRA', 'INTERSEXUAL');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_reason_enum') THEN
        CREATE TYPE appointment_reason_enum AS ENUM ('CONSULTA_GENERAL', 'VACUNACION', 'TRATAMIENTO', 'CIRUGIA', 'PROCEDIMIENTO', 'CONTROL', 'EMERGENCIA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status_enum') THEN
        CREATE TYPE appointment_status_enum AS ENUM ('PROGRAMADA', 'CONFIRMADA', 'EN_PROCESO', 'FINALIZADA', 'CANCELADA', 'NO_ASISTIO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_entry_type_enum') THEN
        CREATE TYPE queue_entry_type_enum AS ENUM ('CON_CITA', 'SIN_CITA', 'EMERGENCIA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_status_enum') THEN
        CREATE TYPE queue_status_enum AS ENUM ('EN_ESPERA', 'EN_ATENCION', 'FINALIZADA', 'CANCELADA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'encounter_status_enum') THEN
        CREATE TYPE encounter_status_enum AS ENUM ('ACTIVA', 'FINALIZADA', 'ANULADA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'treatment_status_enum') THEN
        CREATE TYPE treatment_status_enum AS ENUM ('ACTIVO', 'FINALIZADO', 'SUSPENDIDO', 'CANCELADO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'treatment_item_status_enum') THEN
        CREATE TYPE treatment_item_status_enum AS ENUM ('ACTIVO', 'SUSPENDIDO', 'FINALIZADO', 'CANCELADO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'surgery_status_enum') THEN
        CREATE TYPE surgery_status_enum AS ENUM ('PROGRAMADA', 'EN_CURSO', 'FINALIZADA', 'CANCELADA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'antiparasitic_type_enum') THEN
        CREATE TYPE antiparasitic_type_enum AS ENUM ('INTERNO', 'EXTERNO', 'MIXTO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vaccine_species_enum') THEN
        CREATE TYPE vaccine_species_enum AS ENUM ('PERRO', 'GATO', 'OTRO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appetite_status_enum') THEN
        CREATE TYPE appetite_status_enum AS ENUM ('NORMAL', 'DISMINUIDO', 'AUMENTADO', 'ANOREXIA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'water_intake_status_enum') THEN
        CREATE TYPE water_intake_status_enum AS ENUM ('NORMAL', 'DISMINUIDO', 'AUMENTADO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hydration_status_enum') THEN
        CREATE TYPE hydration_status_enum AS ENUM ('NORMAL', 'LEVE_DESHIDRATACION', 'MODERADA_DESHIDRATACION', 'SEVERA_DESHIDRATACION');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mucosa_status_enum') THEN
        CREATE TYPE mucosa_status_enum AS ENUM ('NORMAL', 'PALIDA', 'ICTERICA', 'CIANOTICA', 'HIPEREMICA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_owner_type_enum') THEN
        CREATE TYPE media_owner_type_enum AS ENUM ('PACIENTE', 'ATENCION', 'USUARIO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type_enum') THEN
        CREATE TYPE media_type_enum AS ENUM ('IMAGEN', 'PDF', 'DOCUMENTO', 'VIDEO', 'OTRO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'storage_provider_enum') THEN
        CREATE TYPE storage_provider_enum AS ENUM ('LOCAL', 'S3', 'R2', 'CLOUDINARY', 'CONTABO_OBJECT_STORAGE', 'OTRO');
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_softdelete_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL THEN
        NEW.activo = false;
    END IF;

    IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        NEW.deleted_by_usuario_id = NULL;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validate_softdelete_user_reference()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.deleted_by_usuario_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
        RAISE EXCEPTION 'deleted_by_usuario_id requiere deleted_at';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validar_raza_corresponde_especie()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    especie_raza uuid;
BEGIN
    IF NEW.raza_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT especie_id
    INTO especie_raza
    FROM razas_catalogo
    WHERE id = NEW.raza_id
      AND deleted_at IS NULL;

    IF especie_raza IS NULL THEN
        RAISE EXCEPTION 'La raza especificada no existe o fue eliminada';
    END IF;

    IF especie_raza <> NEW.especie_id THEN
        RAISE EXCEPTION 'La raza no corresponde a la especie del paciente';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre varchar(80) NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid
);

CREATE TABLE IF NOT EXISTS personas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_persona person_type_enum NOT NULL,
    nombres varchar(120) NOT NULL,
    apellidos varchar(120) NOT NULL,
    cedula varchar(20),
    telefono varchar(25),
    direccion varchar(255),
    genero gender_enum,
    fecha_nacimiento date,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid
);

CREATE TABLE IF NOT EXISTS usuarios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id uuid NOT NULL,
    correo citext NOT NULL,
    password_hash varchar(255) NOT NULL,
    ultimo_login_at timestamp without time zone,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT fk_usuarios_persona FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS empleados (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id uuid NOT NULL,
    codigo varchar(40),
    cargo varchar(120),
    numero_registro_profesional varchar(80),
    es_mvz boolean NOT NULL DEFAULT false,
    fecha_ingreso date,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT fk_empleados_persona FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS clientes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id uuid NOT NULL,
    observaciones text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT fk_clientes_persona FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS usuarios_roles (
    usuario_id uuid NOT NULL,
    rol_id uuid NOT NULL,
    assigned_at timestamp without time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, rol_id),
    CONSTRAINT fk_usuarios_roles_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_usuarios_roles_rol FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS usuarios_refresh_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid NOT NULL,
    token_hash varchar(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    revoked boolean NOT NULL DEFAULT false,
    revoked_at timestamp without time zone,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT fk_refresh_tokens_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS especies_catalogo (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre varchar(80) NOT NULL,
    descripcion varchar(255),
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid
);

CREATE TABLE IF NOT EXISTS razas_catalogo (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    especie_id uuid NOT NULL,
    nombre varchar(100) NOT NULL,
    descripcion varchar(255),
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT fk_razas_especie FOREIGN KEY (especie_id) REFERENCES especies_catalogo(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS colores_catalogo (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre varchar(80) NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid
);

CREATE TABLE IF NOT EXISTS vacunas_catalogo (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre varchar(120) NOT NULL,
    especie vaccine_species_enum NOT NULL,
    es_revacunacion boolean NOT NULL DEFAULT false,
    activa boolean NOT NULL DEFAULT true,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid
);

CREATE TABLE IF NOT EXISTS catalogo_antiparasitarios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre varchar(120) NOT NULL,
    tipo antiparasitic_type_enum NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid
);

CREATE TABLE IF NOT EXISTS pacientes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo varchar(40),
    nombre varchar(120) NOT NULL,
    especie_id uuid NOT NULL,
    raza_id uuid,
    color_id uuid,
    sexo patient_sex_enum NOT NULL,
    fecha_nacimiento date,
    peso_actual numeric(8,2),
    esterilizado boolean NOT NULL DEFAULT false,
    microchip_codigo varchar(80),
    senas_particulares text,
    alergias_generales text,
    antecedentes_generales text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT ck_pacientes_peso_actual CHECK (peso_actual IS NULL OR peso_actual > 0),
    CONSTRAINT fk_pacientes_especie FOREIGN KEY (especie_id) REFERENCES especies_catalogo(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pacientes_raza FOREIGN KEY (raza_id) REFERENCES razas_catalogo(id) ON DELETE SET NULL,
    CONSTRAINT fk_pacientes_color FOREIGN KEY (color_id) REFERENCES colores_catalogo(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pacientes_tutores (
    paciente_id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    es_principal boolean NOT NULL DEFAULT false,
    parentesco_o_relacion varchar(80),
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    PRIMARY KEY (paciente_id, cliente_id),
    CONSTRAINT fk_pacientes_tutores_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    CONSTRAINT fk_pacientes_tutores_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pacientes_condiciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id uuid NOT NULL,
    tipo varchar(80) NOT NULL,
    nombre varchar(120) NOT NULL,
    descripcion text,
    activa boolean NOT NULL DEFAULT true,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT fk_pacientes_condiciones_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS citas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id uuid NOT NULL,
    mvz_id uuid NOT NULL,
    fecha_programada date NOT NULL,
    hora_programada time without time zone NOT NULL,
    motivo_programada appointment_reason_enum NOT NULL,
    notas text,
    estado_cita appointment_status_enum NOT NULL DEFAULT 'PROGRAMADA',
    created_by_usuario_id uuid,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT fk_citas_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE RESTRICT,
    CONSTRAINT fk_citas_mvz FOREIGN KEY (mvz_id) REFERENCES empleados(id) ON DELETE RESTRICT,
    CONSTRAINT fk_citas_created_by_usuario FOREIGN KEY (created_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cola_atenciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha date NOT NULL,
    cita_id uuid,
    paciente_id uuid NOT NULL,
    mvz_id uuid NOT NULL,
    tipo_ingreso queue_entry_type_enum NOT NULL,
    hora_llegada timestamp without time zone NOT NULL,
    hora_programada time without time zone,
    estado queue_status_enum NOT NULL DEFAULT 'EN_ESPERA',
    observaciones text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT fk_cola_atenciones_cita FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE SET NULL,
    CONSTRAINT fk_cola_atenciones_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE RESTRICT,
    CONSTRAINT fk_cola_atenciones_mvz FOREIGN KEY (mvz_id) REFERENCES empleados(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS atenciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cita_id uuid,
    cola_atencion_id uuid,
    paciente_id uuid NOT NULL,
    mvz_id uuid NOT NULL,
    fecha_hora_inicio timestamp without time zone NOT NULL,
    fecha_hora_fin timestamp without time zone,
    estado encounter_status_enum NOT NULL DEFAULT 'ACTIVA',
    observaciones_generales text,
    created_by_usuario_id uuid,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT ck_atenciones_fechas CHECK (fecha_hora_fin IS NULL OR fecha_hora_fin >= fecha_hora_inicio),
    CONSTRAINT ck_atenciones_estado_fin CHECK (
        (estado = 'ACTIVA' AND fecha_hora_fin IS NULL) OR
        (estado IN ('FINALIZADA', 'ANULADA'))
    ),
    CONSTRAINT fk_atenciones_cita FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE SET NULL,
    CONSTRAINT fk_atenciones_cola FOREIGN KEY (cola_atencion_id) REFERENCES cola_atenciones(id) ON DELETE SET NULL,
    CONSTRAINT fk_atenciones_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE RESTRICT,
    CONSTRAINT fk_atenciones_mvz FOREIGN KEY (mvz_id) REFERENCES empleados(id) ON DELETE RESTRICT,
    CONSTRAINT fk_atenciones_created_by_usuario FOREIGN KEY (created_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS atenciones_motivo_consulta (
    atencion_id uuid PRIMARY KEY,
    motivo_consulta text NOT NULL,
    antecedente_enfermedad_actual text,
    diagnosticos_anteriores_referidos text,
    tratamientos_anteriores_referidos text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT fk_atenciones_motivo_consulta_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS atenciones_anamnesis (
    atencion_id uuid PRIMARY KEY,
    inicio_problema_texto text,
    cirugias_previas_texto text,
    como_empezo_problema_texto text,
    vacunas_al_dia boolean,
    desparasitaciones_al_dia boolean,
    hay_mascota_en_casa boolean,
    mascota_en_casa_detalle text,
    medicamento_administrado_texto text,
    come_estado appetite_status_enum,
    toma_agua_estado water_intake_status_enum,
    heces_texto text,
    vomito_texto text,
    numero_deposiciones integer,
    orina_texto text,
    problemas_respiratorios_texto text,
    dificultad_caminar_texto text,
    observaciones text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT ck_atenciones_anamnesis_numero_deposiciones CHECK (numero_deposiciones IS NULL OR numero_deposiciones >= 0),
    CONSTRAINT fk_atenciones_anamnesis_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS atenciones_examen_clinico (
    atencion_id uuid PRIMARY KEY,
    peso_kg numeric(8,2),
    temperatura_c numeric(5,2),
    pulso integer,
    frecuencia_cardiaca integer,
    frecuencia_respiratoria integer,
    mucosas mucosa_status_enum,
    ganglios_linfaticos varchar(120),
    hidratacion hydration_status_enum,
    tllc_segundos integer,
    observaciones_examen text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT ck_atenciones_examen_peso CHECK (peso_kg IS NULL OR peso_kg > 0),
    CONSTRAINT ck_atenciones_examen_temperatura CHECK (temperatura_c IS NULL OR (temperatura_c >= 20 AND temperatura_c <= 50)),
    CONSTRAINT ck_atenciones_examen_pulso CHECK (pulso IS NULL OR pulso >= 0),
    CONSTRAINT ck_atenciones_examen_fc CHECK (frecuencia_cardiaca IS NULL OR frecuencia_cardiaca >= 0),
    CONSTRAINT ck_atenciones_examen_fr CHECK (frecuencia_respiratoria IS NULL OR frecuencia_respiratoria >= 0),
    CONSTRAINT ck_atenciones_examen_tllc CHECK (tllc_segundos IS NULL OR tllc_segundos >= 0),
    CONSTRAINT fk_atenciones_examen_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS atenciones_datos_medioambientales (
    atencion_id uuid PRIMARY KEY,
    entorno_texto text,
    nutricion_texto text,
    estilo_vida_texto text,
    tipo_alimentacion_texto text,
    observaciones text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT fk_atenciones_datos_medioambientales_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS atenciones_impresion_clinica (
    atencion_id uuid PRIMARY KEY,
    diagnostico_presuntivo text,
    diagnostico_diferencial text,
    pronostico text,
    observaciones_clinicas text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT fk_atenciones_impresion_clinica_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS atenciones_plan (
    atencion_id uuid PRIMARY KEY,
    plan_clinico text,
    requiere_proxima_cita boolean NOT NULL DEFAULT false,
    fecha_sugerida_proxima_cita date,
    observaciones_plan text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT ck_atenciones_plan_proxima_cita CHECK (
        (requiere_proxima_cita = false) OR
        (requiere_proxima_cita = true AND fecha_sugerida_proxima_cita IS NOT NULL)
    ),
    CONSTRAINT fk_atenciones_plan_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tratamientos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    atencion_id uuid NOT NULL,
    estado treatment_status_enum NOT NULL DEFAULT 'ACTIVO',
    fecha_inicio date NOT NULL,
    fecha_fin date,
    indicaciones_generales text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT ck_tratamientos_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
    CONSTRAINT fk_tratamientos_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tratamientos_item (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tratamiento_id uuid NOT NULL,
    medicamento varchar(120) NOT NULL,
    dosis varchar(120) NOT NULL,
    frecuencia varchar(120) NOT NULL,
    duracion_dias integer NOT NULL,
    via_administracion varchar(120) NOT NULL,
    observaciones text,
    estado treatment_item_status_enum NOT NULL DEFAULT 'ACTIVO',
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT ck_tratamientos_item_duracion CHECK (duracion_dias > 0),
    CONSTRAINT fk_tratamientos_item_tratamiento FOREIGN KEY (tratamiento_id) REFERENCES tratamientos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vacunaciones_evento (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    atencion_id uuid NOT NULL,
    vacuna_id uuid NOT NULL,
    fecha_aplicacion date NOT NULL,
    proxima_fecha_sugerida date,
    observaciones text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT fk_vacunaciones_evento_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id) ON DELETE CASCADE,
    CONSTRAINT fk_vacunaciones_evento_vacuna FOREIGN KEY (vacuna_id) REFERENCES vacunas_catalogo(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS desparasitaciones_evento (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    atencion_id uuid NOT NULL,
    producto_id uuid NOT NULL,
    fecha_aplicacion date NOT NULL,
    proxima_fecha_sugerida date,
    observaciones text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT fk_desparasitaciones_evento_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id) ON DELETE CASCADE,
    CONSTRAINT fk_desparasitaciones_evento_producto FOREIGN KEY (producto_id) REFERENCES catalogo_antiparasitarios(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS cirugias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    atencion_id uuid NOT NULL,
    tipo_cirugia varchar(120) NOT NULL,
    fecha_programada timestamp without time zone,
    fecha_realizada timestamp without time zone,
    estado_cirugia surgery_status_enum NOT NULL DEFAULT 'PROGRAMADA',
    descripcion text,
    indicaciones_postoperatorias text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT ck_cirugias_fechas CHECK (
        fecha_programada IS NULL OR fecha_realizada IS NULL OR fecha_realizada >= fecha_programada
    ),
    CONSTRAINT fk_cirugias_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS procedimientos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    atencion_id uuid NOT NULL,
    tipo_procedimiento varchar(120) NOT NULL,
    fecha_realizacion timestamp without time zone NOT NULL,
    descripcion text,
    resultado text,
    observaciones text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT fk_procedimientos_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS archivos_media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type media_owner_type_enum NOT NULL,
    owner_id uuid NOT NULL,
    tipo_media media_type_enum NOT NULL,
    provider storage_provider_enum NOT NULL,
    url text NOT NULL,
    key_storage varchar(255),
    nombre_original varchar(255) NOT NULL,
    mime_type varchar(120),
    size_bytes bigint,
    ancho integer,
    alto integer,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by_usuario_id uuid,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    deleted_by_usuario_id uuid,
    CONSTRAINT ck_archivos_media_size CHECK (size_bytes IS NULL OR size_bytes >= 0),
    CONSTRAINT ck_archivos_media_ancho CHECK (ancho IS NULL OR ancho >= 0),
    CONSTRAINT ck_archivos_media_alto CHECK (alto IS NULL OR alto >= 0),
    CONSTRAINT fk_archivos_media_created_by FOREIGN KEY (created_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

ALTER TABLE roles
    ADD CONSTRAINT fk_roles_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE personas
    ADD CONSTRAINT fk_personas_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE usuarios
    ADD CONSTRAINT fk_usuarios_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE empleados
    ADD CONSTRAINT fk_empleados_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE clientes
    ADD CONSTRAINT fk_clientes_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE usuarios_refresh_tokens
    ADD CONSTRAINT fk_refresh_tokens_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE especies_catalogo
    ADD CONSTRAINT fk_especies_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE razas_catalogo
    ADD CONSTRAINT fk_razas_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE colores_catalogo
    ADD CONSTRAINT fk_colores_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE vacunas_catalogo
    ADD CONSTRAINT fk_vacunas_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE catalogo_antiparasitarios
    ADD CONSTRAINT fk_antiparasitarios_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE pacientes
    ADD CONSTRAINT fk_pacientes_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE pacientes_tutores
    ADD CONSTRAINT fk_pacientes_tutores_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE pacientes_condiciones
    ADD CONSTRAINT fk_pacientes_condiciones_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE citas
    ADD CONSTRAINT fk_citas_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE cola_atenciones
    ADD CONSTRAINT fk_cola_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE atenciones
    ADD CONSTRAINT fk_atenciones_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE atenciones_motivo_consulta
    ADD CONSTRAINT fk_atenciones_motivo_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE atenciones_anamnesis
    ADD CONSTRAINT fk_atenciones_anamnesis_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE atenciones_examen_clinico
    ADD CONSTRAINT fk_atenciones_examen_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE atenciones_datos_medioambientales
    ADD CONSTRAINT fk_atenciones_medio_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE atenciones_impresion_clinica
    ADD CONSTRAINT fk_atenciones_impresion_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE atenciones_plan
    ADD CONSTRAINT fk_atenciones_plan_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE tratamientos
    ADD CONSTRAINT fk_tratamientos_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE tratamientos_item
    ADD CONSTRAINT fk_tratamientos_item_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE vacunaciones_evento
    ADD CONSTRAINT fk_vacunaciones_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE desparasitaciones_evento
    ADD CONSTRAINT fk_desparasitaciones_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE cirugias
    ADD CONSTRAINT fk_cirugias_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE procedimientos
    ADD CONSTRAINT fk_procedimientos_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE archivos_media
    ADD CONSTRAINT fk_archivos_media_deleted_by FOREIGN KEY (deleted_by_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_nombre_live
ON roles(nombre)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_personas_cedula_live
ON personas(cedula)
WHERE cedula IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_persona_live
ON usuarios(persona_id)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_correo_live
ON usuarios(correo)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_empleados_persona_live
ON empleados(persona_id)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_empleados_codigo_live
ON empleados(codigo)
WHERE codigo IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_persona_live
ON clientes(persona_id)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_especies_nombre_live
ON especies_catalogo(nombre)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_razas_especie_nombre_live
ON razas_catalogo(especie_id, nombre)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_colores_nombre_live
ON colores_catalogo(nombre)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vacunas_nombre_live
ON vacunas_catalogo(nombre)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_antiparasitarios_nombre_live
ON catalogo_antiparasitarios(nombre)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pacientes_codigo_live
ON pacientes(codigo)
WHERE codigo IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pacientes_microchip_live
ON pacientes(microchip_codigo)
WHERE microchip_codigo IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pacientes_tutor_principal_live
ON pacientes_tutores(paciente_id)
WHERE es_principal = true AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_citas_mvz_slot_activo_live
ON citas(mvz_id, fecha_programada, hora_programada)
WHERE deleted_at IS NULL
  AND estado_cita IN ('PROGRAMADA', 'CONFIRMADA', 'EN_PROCESO');

CREATE UNIQUE INDEX IF NOT EXISTS uq_cola_atenciones_cita_live
ON cola_atenciones(cita_id)
WHERE cita_id IS NOT NULL
  AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_atencion_activa_por_paciente_live
ON atenciones(paciente_id)
WHERE deleted_at IS NULL
  AND estado = 'ACTIVA';

CREATE UNIQUE INDEX IF NOT EXISTS uq_atencion_activa_por_cola_live
ON atenciones(cola_atencion_id)
WHERE cola_atencion_id IS NOT NULL
  AND deleted_at IS NULL
  AND estado = 'ACTIVA';

CREATE INDEX IF NOT EXISTS idx_roles_deleted_at ON roles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_personas_deleted_at ON personas(deleted_at);
CREATE INDEX IF NOT EXISTS idx_usuarios_deleted_at ON usuarios(deleted_at);
CREATE INDEX IF NOT EXISTS idx_empleados_deleted_at ON empleados(deleted_at);
CREATE INDEX IF NOT EXISTS idx_clientes_deleted_at ON clientes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usuario_id ON usuarios_refresh_tokens(usuario_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_deleted_at ON usuarios_refresh_tokens(deleted_at);
CREATE INDEX IF NOT EXISTS idx_especies_deleted_at ON especies_catalogo(deleted_at);
CREATE INDEX IF NOT EXISTS idx_razas_especie_id ON razas_catalogo(especie_id);
CREATE INDEX IF NOT EXISTS idx_razas_deleted_at ON razas_catalogo(deleted_at);
CREATE INDEX IF NOT EXISTS idx_colores_deleted_at ON colores_catalogo(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vacunas_deleted_at ON vacunas_catalogo(deleted_at);
CREATE INDEX IF NOT EXISTS idx_antiparasitarios_deleted_at ON catalogo_antiparasitarios(deleted_at);
CREATE INDEX IF NOT EXISTS idx_pacientes_especie_id ON pacientes(especie_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_raza_id ON pacientes(raza_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_color_id ON pacientes(color_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_nombre ON pacientes(nombre);
CREATE INDEX IF NOT EXISTS idx_pacientes_deleted_at ON pacientes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_pacientes_tutores_cliente_id ON pacientes_tutores(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_tutores_deleted_at ON pacientes_tutores(deleted_at);
CREATE INDEX IF NOT EXISTS idx_pacientes_condiciones_paciente_id ON pacientes_condiciones(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_condiciones_deleted_at ON pacientes_condiciones(deleted_at);
CREATE INDEX IF NOT EXISTS idx_citas_paciente_id ON citas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_citas_mvz_id ON citas(mvz_id);
CREATE INDEX IF NOT EXISTS idx_citas_fecha_programada ON citas(fecha_programada);
CREATE INDEX IF NOT EXISTS idx_citas_estado_cita ON citas(estado_cita);
CREATE INDEX IF NOT EXISTS idx_citas_deleted_at ON citas(deleted_at);
CREATE INDEX IF NOT EXISTS idx_cola_fecha ON cola_atenciones(fecha);
CREATE INDEX IF NOT EXISTS idx_cola_paciente_id ON cola_atenciones(paciente_id);
CREATE INDEX IF NOT EXISTS idx_cola_mvz_id ON cola_atenciones(mvz_id);
CREATE INDEX IF NOT EXISTS idx_cola_estado ON cola_atenciones(estado);
CREATE INDEX IF NOT EXISTS idx_cola_deleted_at ON cola_atenciones(deleted_at);
CREATE INDEX IF NOT EXISTS idx_atenciones_paciente_id ON atenciones(paciente_id);
CREATE INDEX IF NOT EXISTS idx_atenciones_mvz_id ON atenciones(mvz_id);
CREATE INDEX IF NOT EXISTS idx_atenciones_estado ON atenciones(estado);
CREATE INDEX IF NOT EXISTS idx_atenciones_fecha_inicio ON atenciones(fecha_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_atenciones_deleted_at ON atenciones(deleted_at);
CREATE INDEX IF NOT EXISTS idx_atenciones_motivo_deleted_at ON atenciones_motivo_consulta(deleted_at);
CREATE INDEX IF NOT EXISTS idx_atenciones_anamnesis_deleted_at ON atenciones_anamnesis(deleted_at);
CREATE INDEX IF NOT EXISTS idx_atenciones_examen_deleted_at ON atenciones_examen_clinico(deleted_at);
CREATE INDEX IF NOT EXISTS idx_atenciones_medio_deleted_at ON atenciones_datos_medioambientales(deleted_at);
CREATE INDEX IF NOT EXISTS idx_atenciones_impresion_deleted_at ON atenciones_impresion_clinica(deleted_at);
CREATE INDEX IF NOT EXISTS idx_atenciones_plan_deleted_at ON atenciones_plan(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tratamientos_atencion_id ON tratamientos(atencion_id);
CREATE INDEX IF NOT EXISTS idx_tratamientos_deleted_at ON tratamientos(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tratamientos_item_tratamiento_id ON tratamientos_item(tratamiento_id);
CREATE INDEX IF NOT EXISTS idx_tratamientos_item_deleted_at ON tratamientos_item(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vacunaciones_atencion_id ON vacunaciones_evento(atencion_id);
CREATE INDEX IF NOT EXISTS idx_vacunaciones_vacuna_id ON vacunaciones_evento(vacuna_id);
CREATE INDEX IF NOT EXISTS idx_vacunaciones_deleted_at ON vacunaciones_evento(deleted_at);
CREATE INDEX IF NOT EXISTS idx_desparasitaciones_atencion_id ON desparasitaciones_evento(atencion_id);
CREATE INDEX IF NOT EXISTS idx_desparasitaciones_producto_id ON desparasitaciones_evento(producto_id);
CREATE INDEX IF NOT EXISTS idx_desparasitaciones_deleted_at ON desparasitaciones_evento(deleted_at);
CREATE INDEX IF NOT EXISTS idx_cirugias_atencion_id ON cirugias(atencion_id);
CREATE INDEX IF NOT EXISTS idx_cirugias_estado ON cirugias(estado_cirugia);
CREATE INDEX IF NOT EXISTS idx_cirugias_deleted_at ON cirugias(deleted_at);
CREATE INDEX IF NOT EXISTS idx_procedimientos_atencion_id ON procedimientos(atencion_id);
CREATE INDEX IF NOT EXISTS idx_procedimientos_deleted_at ON procedimientos(deleted_at);
CREATE INDEX IF NOT EXISTS idx_archivos_media_owner ON archivos_media(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_archivos_media_tipo ON archivos_media(tipo_media);
CREATE INDEX IF NOT EXISTS idx_archivos_media_provider ON archivos_media(provider);
CREATE INDEX IF NOT EXISTS idx_archivos_media_deleted_at ON archivos_media(deleted_at);

DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles;
CREATE TRIGGER trg_roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_personas_updated_at ON personas;
CREATE TRIGGER trg_personas_updated_at
BEFORE UPDATE ON personas
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_usuarios_updated_at ON usuarios;
CREATE TRIGGER trg_usuarios_updated_at
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_empleados_updated_at ON empleados;
CREATE TRIGGER trg_empleados_updated_at
BEFORE UPDATE ON empleados
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_clientes_updated_at ON clientes;
CREATE TRIGGER trg_clientes_updated_at
BEFORE UPDATE ON clientes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_especies_updated_at ON especies_catalogo;
CREATE TRIGGER trg_especies_updated_at
BEFORE UPDATE ON especies_catalogo
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_razas_updated_at ON razas_catalogo;
CREATE TRIGGER trg_razas_updated_at
BEFORE UPDATE ON razas_catalogo
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_colores_updated_at ON colores_catalogo;
CREATE TRIGGER trg_colores_updated_at
BEFORE UPDATE ON colores_catalogo
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vacunas_updated_at ON vacunas_catalogo;
CREATE TRIGGER trg_vacunas_updated_at
BEFORE UPDATE ON vacunas_catalogo
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_antiparasitarios_updated_at ON catalogo_antiparasitarios;
CREATE TRIGGER trg_antiparasitarios_updated_at
BEFORE UPDATE ON catalogo_antiparasitarios
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pacientes_updated_at ON pacientes;
CREATE TRIGGER trg_pacientes_updated_at
BEFORE UPDATE ON pacientes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pacientes_condiciones_updated_at ON pacientes_condiciones;
CREATE TRIGGER trg_pacientes_condiciones_updated_at
BEFORE UPDATE ON pacientes_condiciones
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_citas_updated_at ON citas;
CREATE TRIGGER trg_citas_updated_at
BEFORE UPDATE ON citas
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cola_updated_at ON cola_atenciones;
CREATE TRIGGER trg_cola_updated_at
BEFORE UPDATE ON cola_atenciones
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_atenciones_updated_at ON atenciones;
CREATE TRIGGER trg_atenciones_updated_at
BEFORE UPDATE ON atenciones
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_atenciones_motivo_updated_at ON atenciones_motivo_consulta;
CREATE TRIGGER trg_atenciones_motivo_updated_at
BEFORE UPDATE ON atenciones_motivo_consulta
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_atenciones_anamnesis_updated_at ON atenciones_anamnesis;
CREATE TRIGGER trg_atenciones_anamnesis_updated_at
BEFORE UPDATE ON atenciones_anamnesis
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_atenciones_examen_updated_at ON atenciones_examen_clinico;
CREATE TRIGGER trg_atenciones_examen_updated_at
BEFORE UPDATE ON atenciones_examen_clinico
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_atenciones_medio_updated_at ON atenciones_datos_medioambientales;
CREATE TRIGGER trg_atenciones_medio_updated_at
BEFORE UPDATE ON atenciones_datos_medioambientales
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_atenciones_impresion_updated_at ON atenciones_impresion_clinica;
CREATE TRIGGER trg_atenciones_impresion_updated_at
BEFORE UPDATE ON atenciones_impresion_clinica
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_atenciones_plan_updated_at ON atenciones_plan;
CREATE TRIGGER trg_atenciones_plan_updated_at
BEFORE UPDATE ON atenciones_plan
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tratamientos_updated_at ON tratamientos;
CREATE TRIGGER trg_tratamientos_updated_at
BEFORE UPDATE ON tratamientos
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tratamientos_item_updated_at ON tratamientos_item;
CREATE TRIGGER trg_tratamientos_item_updated_at
BEFORE UPDATE ON tratamientos_item
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vacunaciones_updated_at ON vacunaciones_evento;
CREATE TRIGGER trg_vacunaciones_updated_at
BEFORE UPDATE ON vacunaciones_evento
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_desparasitaciones_updated_at ON desparasitaciones_evento;
CREATE TRIGGER trg_desparasitaciones_updated_at
BEFORE UPDATE ON desparasitaciones_evento
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cirugias_updated_at ON cirugias;
CREATE TRIGGER trg_cirugias_updated_at
BEFORE UPDATE ON cirugias
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_procedimientos_updated_at ON procedimientos;
CREATE TRIGGER trg_procedimientos_updated_at
BEFORE UPDATE ON procedimientos
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_archivos_media_updated_at ON archivos_media;
CREATE TRIGGER trg_archivos_media_updated_at
BEFORE UPDATE ON archivos_media
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pacientes_validar_raza ON pacientes;
CREATE TRIGGER trg_pacientes_validar_raza
BEFORE INSERT OR UPDATE ON pacientes
FOR EACH ROW
EXECUTE FUNCTION validar_raza_corresponde_especie();

DROP TRIGGER IF EXISTS trg_roles_softdelete ON roles;
CREATE TRIGGER trg_roles_softdelete
BEFORE INSERT OR UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_personas_softdelete ON personas;
CREATE TRIGGER trg_personas_softdelete
BEFORE INSERT OR UPDATE ON personas
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_usuarios_softdelete ON usuarios;
CREATE TRIGGER trg_usuarios_softdelete
BEFORE INSERT OR UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_empleados_softdelete ON empleados;
CREATE TRIGGER trg_empleados_softdelete
BEFORE INSERT OR UPDATE ON empleados
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_clientes_softdelete ON clientes;
CREATE TRIGGER trg_clientes_softdelete
BEFORE INSERT OR UPDATE ON clientes
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_refresh_tokens_softdelete ON usuarios_refresh_tokens;
CREATE TRIGGER trg_refresh_tokens_softdelete
BEFORE INSERT OR UPDATE ON usuarios_refresh_tokens
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_especies_softdelete ON especies_catalogo;
CREATE TRIGGER trg_especies_softdelete
BEFORE INSERT OR UPDATE ON especies_catalogo
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_razas_softdelete ON razas_catalogo;
CREATE TRIGGER trg_razas_softdelete
BEFORE INSERT OR UPDATE ON razas_catalogo
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_colores_softdelete ON colores_catalogo;
CREATE TRIGGER trg_colores_softdelete
BEFORE INSERT OR UPDATE ON colores_catalogo
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_vacunas_softdelete ON vacunas_catalogo;
CREATE TRIGGER trg_vacunas_softdelete
BEFORE INSERT OR UPDATE ON vacunas_catalogo
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_antiparasitarios_softdelete ON catalogo_antiparasitarios;
CREATE TRIGGER trg_antiparasitarios_softdelete
BEFORE INSERT OR UPDATE ON catalogo_antiparasitarios
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_pacientes_softdelete ON pacientes;
CREATE TRIGGER trg_pacientes_softdelete
BEFORE INSERT OR UPDATE ON pacientes
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_pacientes_tutores_softdelete ON pacientes_tutores;
CREATE TRIGGER trg_pacientes_tutores_softdelete
BEFORE INSERT OR UPDATE ON pacientes_tutores
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_pacientes_condiciones_softdelete ON pacientes_condiciones;
CREATE TRIGGER trg_pacientes_condiciones_softdelete
BEFORE INSERT OR UPDATE ON pacientes_condiciones
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_citas_softdelete ON citas;
CREATE TRIGGER trg_citas_softdelete
BEFORE INSERT OR UPDATE ON citas
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_cola_softdelete ON cola_atenciones;
CREATE TRIGGER trg_cola_softdelete
BEFORE INSERT OR UPDATE ON cola_atenciones
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_atenciones_softdelete ON atenciones;
CREATE TRIGGER trg_atenciones_softdelete
BEFORE INSERT OR UPDATE ON atenciones
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_atenciones_motivo_softdelete ON atenciones_motivo_consulta;
CREATE TRIGGER trg_atenciones_motivo_softdelete
BEFORE INSERT OR UPDATE ON atenciones_motivo_consulta
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_atenciones_anamnesis_softdelete ON atenciones_anamnesis;
CREATE TRIGGER trg_atenciones_anamnesis_softdelete
BEFORE INSERT OR UPDATE ON atenciones_anamnesis
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_atenciones_examen_softdelete ON atenciones_examen_clinico;
CREATE TRIGGER trg_atenciones_examen_softdelete
BEFORE INSERT OR UPDATE ON atenciones_examen_clinico
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_atenciones_medio_softdelete ON atenciones_datos_medioambientales;
CREATE TRIGGER trg_atenciones_medio_softdelete
BEFORE INSERT OR UPDATE ON atenciones_datos_medioambientales
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_atenciones_impresion_softdelete ON atenciones_impresion_clinica;
CREATE TRIGGER trg_atenciones_impresion_softdelete
BEFORE INSERT OR UPDATE ON atenciones_impresion_clinica
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_atenciones_plan_softdelete ON atenciones_plan;
CREATE TRIGGER trg_atenciones_plan_softdelete
BEFORE INSERT OR UPDATE ON atenciones_plan
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_tratamientos_softdelete ON tratamientos;
CREATE TRIGGER trg_tratamientos_softdelete
BEFORE INSERT OR UPDATE ON tratamientos
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_tratamientos_item_softdelete ON tratamientos_item;
CREATE TRIGGER trg_tratamientos_item_softdelete
BEFORE INSERT OR UPDATE ON tratamientos_item
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_vacunaciones_softdelete ON vacunaciones_evento;
CREATE TRIGGER trg_vacunaciones_softdelete
BEFORE INSERT OR UPDATE ON vacunaciones_evento
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_desparasitaciones_softdelete ON desparasitaciones_evento;
CREATE TRIGGER trg_desparasitaciones_softdelete
BEFORE INSERT OR UPDATE ON desparasitaciones_evento
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_cirugias_softdelete ON cirugias;
CREATE TRIGGER trg_cirugias_softdelete
BEFORE INSERT OR UPDATE ON cirugias
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_procedimientos_softdelete ON procedimientos;
CREATE TRIGGER trg_procedimientos_softdelete
BEFORE INSERT OR UPDATE ON procedimientos
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_archivos_media_softdelete ON archivos_media;
CREATE TRIGGER trg_archivos_media_softdelete
BEFORE INSERT OR UPDATE ON archivos_media
FOR EACH ROW
EXECUTE FUNCTION enforce_softdelete_consistency();

DROP TRIGGER IF EXISTS trg_roles_validate_softdelete_user ON roles;
CREATE TRIGGER trg_roles_validate_softdelete_user
BEFORE INSERT OR UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_personas_validate_softdelete_user ON personas;
CREATE TRIGGER trg_personas_validate_softdelete_user
BEFORE INSERT OR UPDATE ON personas
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_usuarios_validate_softdelete_user ON usuarios;
CREATE TRIGGER trg_usuarios_validate_softdelete_user
BEFORE INSERT OR UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_empleados_validate_softdelete_user ON empleados;
CREATE TRIGGER trg_empleados_validate_softdelete_user
BEFORE INSERT OR UPDATE ON empleados
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_clientes_validate_softdelete_user ON clientes;
CREATE TRIGGER trg_clientes_validate_softdelete_user
BEFORE INSERT OR UPDATE ON clientes
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_refresh_tokens_validate_softdelete_user ON usuarios_refresh_tokens;
CREATE TRIGGER trg_refresh_tokens_validate_softdelete_user
BEFORE INSERT OR UPDATE ON usuarios_refresh_tokens
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_especies_validate_softdelete_user ON especies_catalogo;
CREATE TRIGGER trg_especies_validate_softdelete_user
BEFORE INSERT OR UPDATE ON especies_catalogo
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_razas_validate_softdelete_user ON razas_catalogo;
CREATE TRIGGER trg_razas_validate_softdelete_user
BEFORE INSERT OR UPDATE ON razas_catalogo
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_colores_validate_softdelete_user ON colores_catalogo;
CREATE TRIGGER trg_colores_validate_softdelete_user
BEFORE INSERT OR UPDATE ON colores_catalogo
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_vacunas_validate_softdelete_user ON vacunas_catalogo;
CREATE TRIGGER trg_vacunas_validate_softdelete_user
BEFORE INSERT OR UPDATE ON vacunas_catalogo
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_antiparasitarios_validate_softdelete_user ON catalogo_antiparasitarios;
CREATE TRIGGER trg_antiparasitarios_validate_softdelete_user
BEFORE INSERT OR UPDATE ON catalogo_antiparasitarios
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_pacientes_validate_softdelete_user ON pacientes;
CREATE TRIGGER trg_pacientes_validate_softdelete_user
BEFORE INSERT OR UPDATE ON pacientes
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_pacientes_tutores_validate_softdelete_user ON pacientes_tutores;
CREATE TRIGGER trg_pacientes_tutores_validate_softdelete_user
BEFORE INSERT OR UPDATE ON pacientes_tutores
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_pacientes_condiciones_validate_softdelete_user ON pacientes_condiciones;
CREATE TRIGGER trg_pacientes_condiciones_validate_softdelete_user
BEFORE INSERT OR UPDATE ON pacientes_condiciones
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_citas_validate_softdelete_user ON citas;
CREATE TRIGGER trg_citas_validate_softdelete_user
BEFORE INSERT OR UPDATE ON citas
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_cola_validate_softdelete_user ON cola_atenciones;
CREATE TRIGGER trg_cola_validate_softdelete_user
BEFORE INSERT OR UPDATE ON cola_atenciones
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_atenciones_validate_softdelete_user ON atenciones;
CREATE TRIGGER trg_atenciones_validate_softdelete_user
BEFORE INSERT OR UPDATE ON atenciones
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_atenciones_motivo_validate_softdelete_user ON atenciones_motivo_consulta;
CREATE TRIGGER trg_atenciones_motivo_validate_softdelete_user
BEFORE INSERT OR UPDATE ON atenciones_motivo_consulta
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_atenciones_anamnesis_validate_softdelete_user ON atenciones_anamnesis;
CREATE TRIGGER trg_atenciones_anamnesis_validate_softdelete_user
BEFORE INSERT OR UPDATE ON atenciones_anamnesis
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_atenciones_examen_validate_softdelete_user ON atenciones_examen_clinico;
CREATE TRIGGER trg_atenciones_examen_validate_softdelete_user
BEFORE INSERT OR UPDATE ON atenciones_examen_clinico
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_atenciones_medio_validate_softdelete_user ON atenciones_datos_medioambientales;
CREATE TRIGGER trg_atenciones_medio_validate_softdelete_user
BEFORE INSERT OR UPDATE ON atenciones_datos_medioambientales
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_atenciones_impresion_validate_softdelete_user ON atenciones_impresion_clinica;
CREATE TRIGGER trg_atenciones_impresion_validate_softdelete_user
BEFORE INSERT OR UPDATE ON atenciones_impresion_clinica
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_atenciones_plan_validate_softdelete_user ON atenciones_plan;
CREATE TRIGGER trg_atenciones_plan_validate_softdelete_user
BEFORE INSERT OR UPDATE ON atenciones_plan
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_tratamientos_validate_softdelete_user ON tratamientos;
CREATE TRIGGER trg_tratamientos_validate_softdelete_user
BEFORE INSERT OR UPDATE ON tratamientos
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_tratamientos_item_validate_softdelete_user ON tratamientos_item;
CREATE TRIGGER trg_tratamientos_item_validate_softdelete_user
BEFORE INSERT OR UPDATE ON tratamientos_item
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_vacunaciones_validate_softdelete_user ON vacunaciones_evento;
CREATE TRIGGER trg_vacunaciones_validate_softdelete_user
BEFORE INSERT OR UPDATE ON vacunaciones_evento
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_desparasitaciones_validate_softdelete_user ON desparasitaciones_evento;
CREATE TRIGGER trg_desparasitaciones_validate_softdelete_user
BEFORE INSERT OR UPDATE ON desparasitaciones_evento
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_cirugias_validate_softdelete_user ON cirugias;
CREATE TRIGGER trg_cirugias_validate_softdelete_user
BEFORE INSERT OR UPDATE ON cirugias
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_procedimientos_validate_softdelete_user ON procedimientos;
CREATE TRIGGER trg_procedimientos_validate_softdelete_user
BEFORE INSERT OR UPDATE ON procedimientos
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

DROP TRIGGER IF EXISTS trg_archivos_media_validate_softdelete_user ON archivos_media;
CREATE TRIGGER trg_archivos_media_validate_softdelete_user
BEFORE INSERT OR UPDATE ON archivos_media
FOR EACH ROW
EXECUTE FUNCTION validate_softdelete_user_reference();

INSERT INTO roles (nombre, activo)
VALUES
    ('ADMIN', true),
    ('MVZ', true),
    ('RECEPCIONISTA', true),
    ('CLIENTE_APP', true)
ON CONFLICT DO NOTHING;

INSERT INTO especies_catalogo (nombre, descripcion, activo)
VALUES
    ('Perro', 'Caninos domésticos', true),
    ('Gato', 'Felinos domésticos', true),
    ('Otro', 'Otras especies atendidas', true)
ON CONFLICT DO NOTHING;

INSERT INTO colores_catalogo (nombre, activo)
VALUES
    ('Negro', true),
    ('Blanco', true),
    ('Marrón', true),
    ('Gris', true),
    ('Dorado', true),
    ('Café', true),
    ('Beige', true),
    ('Atigrado', true)
ON CONFLICT DO NOTHING;

INSERT INTO vacunas_catalogo (nombre, especie, es_revacunacion, activa, activo)
VALUES
    ('Triple Canina', 'PERRO', false, true, true),
    ('Antirrábica Canina', 'PERRO', false, true, true),
    ('Séxtuple Canina', 'PERRO', false, true, true),
    ('Triple Felina', 'GATO', false, true, true),
    ('Antirrábica Felina', 'GATO', false, true, true)
ON CONFLICT DO NOTHING;

INSERT INTO catalogo_antiparasitarios (nombre, tipo, activo)
VALUES
    ('Albendazol', 'INTERNO', true),
    ('Fipronil', 'EXTERNO', true),
    ('Milbemicina + Praziquantel', 'MIXTO', true)
ON CONFLICT DO NOTHING;