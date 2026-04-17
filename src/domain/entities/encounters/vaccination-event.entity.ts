import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import type { Encounter } from './encounter.entity.js';
import { Vaccine } from '../catalogs/vaccine.entity.js';
import type { PatientVaccineRecord } from '../patients/patient-vaccine-record.entity.js';

@Entity({ name: 'vaccination_events' })
export class VaccinationEvent extends BaseAuditEntity {
  @Column({ name: 'encounter_id', type: 'int' })
  encounterId!: number;

  @ManyToOne('Encounter', 'vaccinationEvents', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @Column({ name: 'vaccine_id', type: 'int' })
  vaccineId!: number;

  @ManyToOne(() => Vaccine, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vaccine_id' })
  vaccine!: Vaccine;

  @Column({ name: 'application_date', type: 'date' })
  applicationDate!: Date;

  @Column({ name: 'suggested_next_date', type: 'date', nullable: true })
  suggestedNextDate!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'patient_vaccine_record_id', type: 'int', nullable: true })
  patientVaccineRecordId!: number | null;

  @ManyToOne('PatientVaccineRecord', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'patient_vaccine_record_id' })
  patientVaccineRecord!: PatientVaccineRecord | null;
}
