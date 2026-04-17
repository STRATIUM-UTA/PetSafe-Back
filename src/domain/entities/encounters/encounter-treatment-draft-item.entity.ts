import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import { TreatmentItemStatusEnum } from '../../enums/index.js';
import type { EncounterTreatmentDraft } from './encounter-treatment-draft.entity.js';

@Entity({ name: 'encounter_treatment_draft_items' })
export class EncounterTreatmentDraftItem extends BaseAuditEntity {
  @Column({ name: 'draft_id', type: 'int' })
  draftId!: number;

  @ManyToOne('EncounterTreatmentDraft', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'draft_id' })
  draft!: EncounterTreatmentDraft;

  @Column({ type: 'varchar', length: 120 })
  medication!: string;

  @Column({ type: 'varchar', length: 120 })
  dose!: string;

  @Column({ type: 'varchar', length: 120 })
  frequency!: string;

  @Column({ name: 'duration_days', type: 'integer' })
  durationDays!: number;

  @Column({ name: 'administration_route', type: 'varchar', length: 120 })
  administrationRoute!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({
    type: 'enum',
    enum: TreatmentItemStatusEnum,
    enumName: 'treatment_item_status_enum',
    default: TreatmentItemStatusEnum.ACTIVO,
  })
  status!: TreatmentItemStatusEnum;
}
