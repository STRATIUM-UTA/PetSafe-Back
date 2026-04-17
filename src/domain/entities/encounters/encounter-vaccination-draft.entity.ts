import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import type { Encounter } from './encounter.entity.js';
import type { Vaccine } from '../catalogs/vaccine.entity.js';
import type { PatientVaccinationPlanDose } from '../vaccinations/patient-vaccination-plan-dose.entity.js';

@Entity({ name: 'encounter_vaccination_drafts' })
export class EncounterVaccinationDraft extends BaseAuditEntity {
  @Column({ name: 'encounter_id', type: 'int' })
  encounterId!: number;

  @ManyToOne('Encounter', 'vaccinationDrafts', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @Column({ name: 'plan_dose_id', type: 'int', nullable: true })
  planDoseId!: number | null;

  @ManyToOne('PatientVaccinationPlanDose', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'plan_dose_id' })
  planDose!: PatientVaccinationPlanDose | null;

  @Column({ name: 'vaccine_id', type: 'int' })
  vaccineId!: number;

  @ManyToOne('Vaccine', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vaccine_id' })
  vaccine!: Vaccine;

  @Column({ name: 'application_date', type: 'date' })
  applicationDate!: Date;

  @Column({ name: 'suggested_next_date', type: 'date', nullable: true })
  suggestedNextDate!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
