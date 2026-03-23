import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity.js';
import type { Atencion } from './atencion.entity.js';

@Entity({ name: 'procedimientos' })
export class Procedimiento extends BaseAuditEntity {
  @Column({ name: 'atencion_id', type: 'uuid' })
  atencionId!: string;

  @ManyToOne('Atencion', 'procedimientos', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'atencion_id' })
  atencion!: Atencion;

  @Column({ name: 'tipo_procedimiento', type: 'varchar', length: 120 })
  tipoProcedimiento!: string;

  @Column({ name: 'fecha_realizacion', type: 'timestamp without time zone' })
  fechaRealizacion!: Date;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ type: 'text', nullable: true })
  resultado!: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;
}
