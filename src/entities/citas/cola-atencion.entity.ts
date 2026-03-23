import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity.js';
import {
  QueueEntryTypeEnum,
  QueueStatusEnum,
} from '../../common/enums/index.js';
import { Cita } from './cita.entity.js';
import { Paciente } from '../pacientes/paciente.entity.js';
import { Empleado } from '../personas/empleado.entity.js';

@Entity({ name: 'cola_atenciones' })
export class ColaAtencion extends BaseAuditEntity {
  @Column({ type: 'date' })
  fecha!: Date;

  @Column({ name: 'cita_id', type: 'int', nullable: true })
  citaId!: number | null;

  @ManyToOne(() => Cita, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cita_id' })
  cita!: Cita | null;

  @Column({ name: 'paciente_id', type: 'int' })
  pacienteId!: number ;

  @ManyToOne(() => Paciente, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'paciente_id' })
  paciente!: Paciente;

  @Column({ name: 'mvz_id', type: 'int' })
  mvzId!: number ;

  @ManyToOne(() => Empleado, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'mvz_id' })
  mvz!: Empleado;

  @Column({
    name: 'tipo_ingreso',
    type: 'enum',
    enum: QueueEntryTypeEnum,
    enumName: 'queue_entry_type_enum',
  })
  tipoIngreso!: QueueEntryTypeEnum;

  @Column({ name: 'hora_llegada', type: 'timestamp without time zone' })
  horaLlegada!: Date;

  @Column({
    name: 'hora_programada',
    type: 'time without time zone',
    nullable: true,
  })
  horaProgramada!: string | null;

  @Column({
    type: 'enum',
    enum: QueueStatusEnum,
    enumName: 'queue_status_enum',
    default: QueueStatusEnum.EN_ESPERA,
  })
  estado!: QueueStatusEnum;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;
}
