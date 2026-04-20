import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import type { Encounter } from './encounter.entity.js';
import type { EncounterTreatmentDraftItem } from './encounter-treatment-draft-item.entity.js';
import type { Treatment } from './treatment.entity.js';

@Entity({ name: 'encounter_treatment_drafts' })
export class EncounterTreatmentDraft extends BaseAuditEntity {
  @Column({ name: 'encounter_id', type: 'int' })
  encounterId!: number;

  @ManyToOne('Encounter', 'treatmentDrafts', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: Date | null;

  @Column({ name: 'general_instructions', type: 'text', nullable: true })
  generalInstructions!: string | null;

  @Column({ name: 'replaces_treatment_id', type: 'int', nullable: true })
  replacesTreatmentId!: number | null;

  @ManyToOne('Treatment', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'replaces_treatment_id' })
  replacesTreatment!: Treatment | null;

  @OneToMany('EncounterTreatmentDraftItem', 'draft', { cascade: true })
  items!: EncounterTreatmentDraftItem[];
}
