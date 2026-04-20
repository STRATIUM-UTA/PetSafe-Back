import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { BaseAuditEntity } from '../base-audit.entity.js';
import { ClinicalCaseStatusEnum } from '../../enums/index.js';
import type { Patient } from '../patients/patient.entity.js';
import type { Encounter } from './encounter.entity.js';
import type { ClinicalCaseFollowUp } from './clinical-case-follow-up.entity.js';
import type { Treatment } from './treatment.entity.js';
import type { TreatmentEvolutionEvent } from './treatment-evolution-event.entity.js';

@Entity({ name: 'clinical_cases' })
export class ClinicalCase extends BaseAuditEntity {
  @Column({ name: 'patient_id', type: 'int' })
  patientId!: number;

  @ManyToOne('Patient', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'origin_encounter_id', type: 'int' })
  originEncounterId!: number;

  @ManyToOne('Encounter', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'origin_encounter_id' })
  originEncounter!: Encounter;

  @Column({
    type: 'enum',
    enum: ClinicalCaseStatusEnum,
    enumName: 'clinical_case_status_enum',
    default: ClinicalCaseStatusEnum.ABIERTO,
  })
  status!: ClinicalCaseStatusEnum;

  @Column({ name: 'problem_summary', type: 'varchar', length: 240 })
  problemSummary!: string;

  @Column({ name: 'problem_summary_normalized', type: 'varchar', length: 240 })
  problemSummaryNormalized!: string;

  @Column({
    name: 'opened_at',
    type: 'timestamp without time zone',
    default: () => 'now()',
  })
  openedAt!: Date;

  @Column({ name: 'closed_at', type: 'timestamp without time zone', nullable: true })
  closedAt!: Date | null;

  @Column({ name: 'canceled_at', type: 'timestamp without time zone', nullable: true })
  canceledAt!: Date | null;

  @OneToMany('Encounter', 'clinicalCase')
  encounters!: Encounter[];

  @OneToMany('ClinicalCaseFollowUp', 'clinicalCase')
  followUps!: ClinicalCaseFollowUp[];

  @OneToMany('Treatment', 'clinicalCase')
  treatments!: Treatment[];

  @OneToMany('TreatmentEvolutionEvent', 'clinicalCase')
  treatmentEvolutionEvents!: TreatmentEvolutionEvent[];
}
