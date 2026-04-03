import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import type { Vaccine } from '../catalogs/vaccine.entity.js';
import type { VaccinationSchemeVersion } from './vaccination-scheme-version.entity.js';
import type { PatientVaccinationPlanDose } from './patient-vaccination-plan-dose.entity.js';

@Entity({ name: 'vaccination_scheme_version_doses' })
export class VaccinationSchemeVersionDose extends BaseAuditEntity {
  @Column({ name: 'scheme_version_id', type: 'int' })
  schemeVersionId!: number;

  @ManyToOne('VaccinationSchemeVersion', 'doses', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheme_version_id' })
  schemeVersion!: VaccinationSchemeVersion;

  @Column({ name: 'vaccine_id', type: 'int' })
  vaccineId!: number;

  @ManyToOne('Vaccine', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vaccine_id' })
  vaccine!: Vaccine;

  @Column({ name: 'dose_order', type: 'int' })
  doseOrder!: number;

  @Column({ name: 'age_start_weeks', type: 'int', nullable: true })
  ageStartWeeks!: number | null;

  @Column({ name: 'age_end_weeks', type: 'int', nullable: true })
  ageEndWeeks!: number | null;

  @Column({ name: 'interval_days', type: 'int', nullable: true })
  intervalDays!: number | null;

  @Column({ name: 'is_required', type: 'boolean', default: true })
  isRequired!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany('PatientVaccinationPlanDose', 'schemeDose')
  planDoses!: PatientVaccinationPlanDose[];
}
