import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import type { Encounter } from './encounter.entity.js';
import type { ProcedureCatalog } from '../catalogs/procedure-catalog.entity.js';

@Entity({ name: 'encounter_procedure_drafts' })
export class EncounterProcedureDraft extends BaseAuditEntity {
  @Column({ name: 'encounter_id', type: 'int' })
  encounterId!: number;

  @ManyToOne('Encounter', 'procedureDrafts', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @Column({ name: 'catalog_id', type: 'int', nullable: true })
  catalogId!: number | null;

  @ManyToOne('ProcedureCatalog', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'catalog_id' })
  catalog!: ProcedureCatalog | null;

  @Column({ name: 'procedure_type', type: 'varchar', length: 120, nullable: true })
  procedureType!: string | null;

  @Column({ name: 'performed_date', type: 'timestamp without time zone' })
  performedDate!: Date;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  result!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
