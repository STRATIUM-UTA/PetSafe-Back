import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';

import { BaseAuditEntity } from '../base-audit.entity.js';
import { TreatmentEvolutionEventTypeEnum } from '../../enums/index.js';
import type { Encounter } from './encounter.entity.js';
import type { Treatment } from './treatment.entity.js';

@Entity({ name: 'encounter_treatment_review_drafts' })
export class EncounterTreatmentReviewDraft extends BaseAuditEntity {
  @Column({ name: 'encounter_id', type: 'int' })
  encounterId!: number;

  @ManyToOne('Encounter', 'treatmentReviewDrafts', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @Column({ name: 'source_treatment_id', type: 'int' })
  sourceTreatmentId!: number;

  @ManyToOne('Treatment', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_treatment_id' })
  sourceTreatment!: Treatment;

  @Column({
    type: 'enum',
    enum: TreatmentEvolutionEventTypeEnum,
    enumName: 'treatment_evolution_event_type_enum',
  })
  action!: TreatmentEvolutionEventTypeEnum;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
