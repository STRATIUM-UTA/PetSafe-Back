import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity.js';
import {
  AppointmentReasonEnum,
  AppointmentStatusEnum,
} from '../../common/enums/index.js';
import { Paciente } from '../pacientes/paciente.entity.js';
import { Empleado } from '../personas/empleado.entity.js';
import { Usuario } from '../auth/usuario.entity.js';

@Entity({ name: 'citas' })
export class Cita extends BaseAuditEntity {
  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId!: string;

  @ManyToOne(() => Paciente, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'paciente_id' })
  paciente!: Paciente;

  @Column({ name: 'mvz_id', type: 'uuid' })
  mvzId!: string;

  @ManyToOne(() => Empleado, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'mvz_id' })
  mvz!: Empleado;

  @Column({ name: 'fecha_programada', type: 'date' })
  fechaProgramada!: Date;

  @Column({ name: 'hora_programada', type: 'time without time zone' })
  horaProgramada!: string;

  @Column({
    name: 'motivo_programada',
    type: 'enum',
    enum: AppointmentReasonEnum,
    enumName: 'appointment_reason_enum',
  })
  motivoProgramada!: AppointmentReasonEnum;

  @Column({ type: 'text', nullable: true })
  notas!: string | null;

  @Column({
    name: 'estado_cita',
    type: 'enum',
    enum: AppointmentStatusEnum,
    enumName: 'appointment_status_enum',
    default: AppointmentStatusEnum.PROGRAMADA,
  })
  estadoCita!: AppointmentStatusEnum;

  @Column({ name: 'created_by_usuario_id', type: 'uuid', nullable: true })
  createdByUsuarioId!: string | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_usuario_id' })
  createdByUsuario!: Usuario | null;
}
