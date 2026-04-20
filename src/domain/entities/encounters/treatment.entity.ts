import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import { TreatmentStatusEnum } from '../../enums/index.js';
import type { Encounter } from './encounter.entity.js';
import type { TreatmentItem } from './treatment-item.entity.js';
import type { ClinicalCase } from './clinical-case.entity.js';

@Entity({ name: 'treatments' })
export class Treatment extends BaseAuditEntity {
  @Column({ name: 'encounter_id', type: 'int' })
  encounterId!: number;

  @ManyToOne('Encounter', 'treatments', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @Column({
    type: 'enum',
    enum: TreatmentStatusEnum,
    enumName: 'treatment_status_enum',
    default: TreatmentStatusEnum.ACTIVO,
  })
  status!: TreatmentStatusEnum;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: Date | null;

  @Column({ name: 'general_instructions', type: 'text', nullable: true })
  generalInstructions!: string | null;

  @Column({ name: 'clinical_case_id', type: 'int', nullable: true })
  clinicalCaseId!: number | null;

  @ManyToOne('ClinicalCase', 'treatments', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'clinical_case_id' })
  clinicalCase!: ClinicalCase | null;

  @Column({ name: 'closed_by_encounter_id', type: 'int', nullable: true })
  closedByEncounterId!: number | null;

  @ManyToOne('Encounter', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'closed_by_encounter_id' })
  closedByEncounter!: Encounter | null;

  @Column({ name: 'replaces_treatment_id', type: 'int', nullable: true })
  replacesTreatmentId!: number | null;

  @ManyToOne('Treatment', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'replaces_treatment_id' })
  replacesTreatment!: Treatment | null;

  @OneToMany('TreatmentItem', 'treatment', { cascade: true })
  items!: TreatmentItem[];
}
