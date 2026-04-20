import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
} from 'typeorm';
import type { Encounter } from './encounter.entity.js';
import {
  ClinicalCaseOutcomeEnum,
  ClinicalCasePlanLinkModeEnum,
} from '../../enums/index.js';
import type { ClinicalCase } from './clinical-case.entity.js';

@Entity({ name: 'encounter_plans' })
export class EncounterPlan {
  @PrimaryColumn({ name: 'encounter_id', type: 'int' })
  encounterId!: number;

  @OneToOne('Encounter', 'plan', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @Column({ name: 'clinical_plan', type: 'text', nullable: true })
  clinicalPlan!: string | null;

  @Column({ name: 'requires_follow_up', type: 'boolean', default: false })
  requiresFollowUp!: boolean;

  @Column({ name: 'suggested_follow_up_date', type: 'date', nullable: true })
  suggestedFollowUpDate!: Date | null;

  @Column({
    name: 'case_link_mode',
    type: 'enum',
    enum: ClinicalCasePlanLinkModeEnum,
    enumName: 'clinical_case_plan_link_mode_enum',
    default: ClinicalCasePlanLinkModeEnum.NONE,
  })
  caseLinkMode!: ClinicalCasePlanLinkModeEnum;

  @Column({ name: 'clinical_case_id', type: 'int', nullable: true })
  clinicalCaseId!: number | null;

  @ManyToOne('ClinicalCase', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'clinical_case_id' })
  clinicalCase!: ClinicalCase | null;

  @Column({ name: 'problem_summary', type: 'varchar', length: 240, nullable: true })
  problemSummary!: string | null;

  @Column({
    name: 'case_outcome',
    type: 'enum',
    enum: ClinicalCaseOutcomeEnum,
    enumName: 'clinical_case_outcome_enum',
    default: ClinicalCaseOutcomeEnum.CONTINUA,
  })
  caseOutcome!: ClinicalCaseOutcomeEnum;

  @Column({ name: 'plan_notes', type: 'text', nullable: true })
  planNotes!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp without time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp without time zone' })
  updatedAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp without time zone',
    nullable: true,
  })
  deletedAt!: Date | null;

  @Column({ name: 'deleted_by_user_id', type: 'int', nullable: true })
  deletedByUserId!: number | null;
}
