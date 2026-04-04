import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import { PatientVaccinationPlanDoseStatusEnum } from '../../enums/index.js';
import type { Vaccine } from '../catalogs/vaccine.entity.js';
import type { PatientVaccineRecord } from '../patients/patient-vaccine-record.entity.js';
import type { PatientVaccinationPlan } from './patient-vaccination-plan.entity.js';
import type { VaccinationSchemeVersionDose } from './vaccination-scheme-version-dose.entity.js';

@Entity({ name: 'patient_vaccination_plan_doses' })
export class PatientVaccinationPlanDose extends BaseAuditEntity {
  @Column({ name: 'plan_id', type: 'int' })
  planId!: number;

  @ManyToOne('PatientVaccinationPlan', 'doses', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan!: PatientVaccinationPlan;

  @Column({ name: 'scheme_dose_id', type: 'int' })
  schemeDoseId!: number;

  @ManyToOne('VaccinationSchemeVersionDose', 'planDoses', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'scheme_dose_id' })
  schemeDose!: VaccinationSchemeVersionDose;

  @Column({ name: 'vaccine_id', type: 'int' })
  vaccineId!: number;

  @ManyToOne('Vaccine', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vaccine_id' })
  vaccine!: Vaccine;

  @Column({ name: 'dose_order', type: 'int' })
  doseOrder!: number;

  @Column({
    type: 'enum',
    enum: PatientVaccinationPlanDoseStatusEnum,
    enumName: 'patient_vaccination_plan_dose_status_enum',
    default: PatientVaccinationPlanDoseStatusEnum.NO_APLICADA,
  })
  status!: PatientVaccinationPlanDoseStatusEnum;

  @Column({ name: 'expected_date', type: 'date', nullable: true })
  expectedDate!: Date | null;

  @Column({ name: 'applied_at', type: 'date', nullable: true })
  appliedAt!: Date | null;

  @Column({ name: 'application_record_id', type: 'int', nullable: true })
  applicationRecordId!: number | null;

  @ManyToOne('PatientVaccineRecord', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'application_record_id' })
  applicationRecord!: PatientVaccineRecord | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
