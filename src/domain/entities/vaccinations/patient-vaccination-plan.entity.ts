import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import { PatientVaccinationPlanStatusEnum } from '../../enums/index.js';
import type { Patient } from '../patients/patient.entity.js';
import type { VaccinationSchemeVersion } from './vaccination-scheme-version.entity.js';
import type { PatientVaccinationPlanDose } from './patient-vaccination-plan-dose.entity.js';

@Entity({ name: 'patient_vaccination_plans' })
export class PatientVaccinationPlan extends BaseAuditEntity {
  @Column({ name: 'patient_id', type: 'int' })
  patientId!: number;

  @ManyToOne('Patient', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'scheme_version_id', type: 'int' })
  schemeVersionId!: number;

  @ManyToOne('VaccinationSchemeVersion', 'patientPlans', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'scheme_version_id' })
  schemeVersion!: VaccinationSchemeVersion;

  @Column({
    type: 'enum',
    enum: PatientVaccinationPlanStatusEnum,
    enumName: 'patient_vaccination_plan_status_enum',
    default: PatientVaccinationPlanStatusEnum.ACTIVO,
  })
  status!: PatientVaccinationPlanStatusEnum;

  @Column({ name: 'assigned_at', type: 'timestamp without time zone', default: () => 'now()' })
  assignedAt!: Date;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany('PatientVaccinationPlanDose', 'plan')
  doses!: PatientVaccinationPlanDose[];
}
