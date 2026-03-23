import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity.js';
import { EncounterStatusEnum } from '../../common/enums/index.js';
import type { Cita } from '../citas/cita.entity.js';
import type { ColaAtencion } from '../citas/cola-atencion.entity.js';
import type { Paciente } from '../pacientes/paciente.entity.js';
import type { Empleado } from '../personas/empleado.entity.js';
import type { Usuario } from '../auth/usuario.entity.js';
import type { AtencionMotivoConsulta } from './atencion-motivo-consulta.entity.js';
import type { AtencionAnamnesis } from './atencion-anamnesis.entity.js';
import type { AtencionExamenClinico } from './atencion-examen-clinico.entity.js';
import type { AtencionDatosMedioambientales } from './atencion-datos-medioambientales.entity.js';
import type { AtencionImpresionClinica } from './atencion-impresion-clinica.entity.js';
import type { AtencionPlan } from './atencion-plan.entity.js';
import type { Tratamiento } from './tratamiento.entity.js';
import type { VacunacionEvento } from './vacunacion-evento.entity.js';
import type { DesparasitacionEvento } from './desparasitacion-evento.entity.js';
import type { Cirugia } from './cirugia.entity.js';
import type { Procedimiento } from './procedimiento.entity.js';

@Entity({ name: 'atenciones' })
export class Atencion extends BaseAuditEntity {
  @Column({ name: 'cita_id', type: 'uuid', nullable: true })
  citaId!: string | null;

  @ManyToOne('Cita', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cita_id' })
  cita!: Cita | null;

  @Column({ name: 'cola_atencion_id', type: 'uuid', nullable: true })
  colaAtencionId!: string | null;

  @ManyToOne('ColaAtencion', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cola_atencion_id' })
  colaAtencion!: ColaAtencion | null;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId!: string;

  @ManyToOne('Paciente', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'paciente_id' })
  paciente!: Paciente;

  @Column({ name: 'mvz_id', type: 'uuid' })
  mvzId!: string;

  @ManyToOne('Empleado', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'mvz_id' })
  mvz!: Empleado;

  @Column({ name: 'fecha_hora_inicio', type: 'timestamp without time zone' })
  fechaHoraInicio!: Date;

  @Column({
    name: 'fecha_hora_fin',
    type: 'timestamp without time zone',
    nullable: true,
  })
  fechaHoraFin!: Date | null;

  @Column({
    type: 'enum',
    enum: EncounterStatusEnum,
    enumName: 'encounter_status_enum',
    default: EncounterStatusEnum.ACTIVA,
  })
  estado!: EncounterStatusEnum;

  @Column({ name: 'observaciones_generales', type: 'text', nullable: true })
  observacionesGenerales!: string | null;

  @Column({ name: 'created_by_usuario_id', type: 'uuid', nullable: true })
  createdByUsuarioId!: string | null;

  @ManyToOne('Usuario', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_usuario_id' })
  createdByUsuario!: Usuario | null;

  // ── Detail sub-entities (1:1) ──
  @OneToOne('AtencionMotivoConsulta', 'atencion', { cascade: true })
  motivoConsulta!: AtencionMotivoConsulta | null;

  @OneToOne('AtencionAnamnesis', 'atencion', { cascade: true })
  anamnesis!: AtencionAnamnesis | null;

  @OneToOne('AtencionExamenClinico', 'atencion', { cascade: true })
  examenClinico!: AtencionExamenClinico | null;

  @OneToOne('AtencionDatosMedioambientales', 'atencion', {
    cascade: true,
  })
  datosMedioambientales!: AtencionDatosMedioambientales | null;

  @OneToOne('AtencionImpresionClinica', 'atencion', {
    cascade: true,
  })
  impresionClinica!: AtencionImpresionClinica | null;

  @OneToOne('AtencionPlan', 'atencion', { cascade: true })
  plan!: AtencionPlan | null;

  // ── Detail sub-entities (1:N) ──
  @OneToMany('Tratamiento', 'atencion', { cascade: true })
  tratamientos!: Tratamiento[];

  @OneToMany('VacunacionEvento', 'atencion', { cascade: true })
  vacunaciones!: VacunacionEvento[];

  @OneToMany('DesparasitacionEvento', 'atencion', { cascade: true })
  desparasitaciones!: DesparasitacionEvento[];

  @OneToMany('Cirugia', 'atencion', { cascade: true })
  cirugias!: Cirugia[];

  @OneToMany('Procedimiento', 'atencion', { cascade: true })
  procedimientos!: Procedimiento[];
}
