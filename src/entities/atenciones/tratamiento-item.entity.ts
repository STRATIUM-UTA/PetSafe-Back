import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity.js';
import { TreatmentItemStatusEnum } from '../../common/enums/index.js';
import type { Tratamiento } from './tratamiento.entity.js';

@Entity({ name: 'tratamientos_item' })
export class TratamientoItem extends BaseAuditEntity {
  @Column({ name: 'tratamiento_id', type: 'uuid' })
  tratamientoId!: string;

  @ManyToOne('Tratamiento', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tratamiento_id' })
  tratamiento!: Tratamiento;

  @Column({ type: 'varchar', length: 120 })
  medicamento!: string;

  @Column({ type: 'varchar', length: 120 })
  dosis!: string;

  @Column({ type: 'varchar', length: 120 })
  frecuencia!: string;

  @Column({ name: 'duracion_dias', type: 'integer' })
  duracionDias!: number;

  @Column({ name: 'via_administracion', type: 'varchar', length: 120 })
  viaAdministracion!: string;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @Column({
    type: 'enum',
    enum: TreatmentItemStatusEnum,
    enumName: 'treatment_item_status_enum',
    default: TreatmentItemStatusEnum.ACTIVO,
  })
  estado!: TreatmentItemStatusEnum;
}
