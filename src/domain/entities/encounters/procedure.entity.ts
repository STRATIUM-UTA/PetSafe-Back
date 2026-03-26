import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import type { Encounter } from './encounter.entity.js';

@Entity({ name: 'procedures' })
export class Procedure extends BaseAuditEntity {
  @Column({ name: 'encounter_id', type: 'int' })
  encounterId!: number;

  @ManyToOne('Encounter', 'procedures', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @Column({ name: 'procedure_type', type: 'varchar', length: 120 })
  procedureType!: string;

  @Column({ name: 'performed_date', type: 'timestamp without time zone' })
  performedDate!: Date;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  result!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
