import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';

import { BaseAuditEntity } from '../base-audit.entity.js';
import { ClinicalCaseFollowUpStatusEnum } from '../../enums/index.js';
import type { ClinicalCase } from './clinical-case.entity.js';
import type { Encounter } from './encounter.entity.js';
import type { Appointment } from '../appointments/appointment.entity.js';

@Entity({ name: 'clinical_case_follow_ups' })
export class ClinicalCaseFollowUp extends BaseAuditEntity {
  @Column({ name: 'clinical_case_id', type: 'int' })
  clinicalCaseId!: number;

  @ManyToOne('ClinicalCase', 'followUps', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinical_case_id' })
  clinicalCase!: ClinicalCase;

  @Column({ name: 'source_encounter_id', type: 'int' })
  sourceEncounterId!: number;

  @ManyToOne('Encounter', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_encounter_id' })
  sourceEncounter!: Encounter;

  @Column({ name: 'generated_appointment_id', type: 'int', nullable: true })
  generatedAppointmentId!: number | null;

  @ManyToOne('Appointment', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'generated_appointment_id' })
  generatedAppointment!: Appointment | null;

  @Column({ name: 'target_encounter_id', type: 'int', nullable: true })
  targetEncounterId!: number | null;

  @ManyToOne('Encounter', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'target_encounter_id' })
  targetEncounter!: Encounter | null;

  @Column({ name: 'suggested_date', type: 'date' })
  suggestedDate!: Date;

  @Column({
    type: 'enum',
    enum: ClinicalCaseFollowUpStatusEnum,
    enumName: 'clinical_case_follow_up_status_enum',
    default: ClinicalCaseFollowUpStatusEnum.PROGRAMADO,
  })
  status!: ClinicalCaseFollowUpStatusEnum;
}
