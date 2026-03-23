import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity.js';
import type { Paciente } from './paciente.entity.js';

@Entity({ name: 'pacientes_condiciones' })
export class PacienteCondicion extends BaseAuditEntity {
  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId!: string;

  @ManyToOne('Paciente', 'condiciones', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paciente_id' })
  paciente!: Paciente;

  @Column({ type: 'varchar', length: 80 })
  tipo!: string;

  @Column({ type: 'varchar', length: 120 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ type: 'boolean', default: true })
  activa!: boolean;
}
