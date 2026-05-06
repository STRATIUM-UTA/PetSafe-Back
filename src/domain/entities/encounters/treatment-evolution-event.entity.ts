import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';

import { BaseAuditEntity } from '../base-audit.entity.js';
import {
  TreatmentEvolutionEventTypeEnum,
  TreatmentStatusEnum,
} from '../../enums/index.js';
import type { Treatment } from './treatment.entity.js';
import type { Encounter } from './encounter.entity.js';
import type { ClinicalCase } from './clinical-case.entity.js';

@Entity({ name: 'treatment_evolution_events' })
export class TreatmentEvolutionEvent extends BaseAuditEntity {
  @Column({ name: 'treatment_id', type: 'int' })
  treatmentId!: number;

  @ManyToOne('Treatment', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'treatment_id' })
  treatment!: Treatment;

  @Column({ name: 'encounter_id', type: 'int' })
  encounterId!: number;

  @ManyToOne('Encounter', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @Column({ name: 'clinical_case_id', type: 'int' })
  clinicalCaseId!: number;

  @ManyToOne('ClinicalCase', 'treatmentEvolutionEvents', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinical_case_id' })
  clinicalCase!: ClinicalCase;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: TreatmentEvolutionEventTypeEnum,
    enumName: 'treatment_evolution_event_type_enum',
  })
  eventType!: TreatmentEvolutionEventTypeEnum;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'replacement_treatment_id', type: 'int', nullable: true })
  replacementTreatmentId!: number | null;

  @ManyToOne('Treatment', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'replacement_treatment_id' })
  replacementTreatment!: Treatment | null;

  @Column({
    name: 'previous_status',
    type: 'enum',
    enum: TreatmentStatusEnum,
    enumName: 'treatment_status_enum',
    nullable: true,
  })
  previousStatus!: TreatmentStatusEnum | null;

  @Column({ name: 'previous_end_date', type: 'date', nullable: true })
  previousEndDate!: Date | null;
}
