import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import { SurgeryStatusEnum } from '../../enums/index.js';
import type { Encounter } from './encounter.entity.js';
import type { SurgeryCatalog } from '../catalogs/surgery-catalog.entity.js';
import type { Patient } from '../patients/patient.entity.js';

@Entity({ name: 'surgeries' })
export class Surgery extends BaseAuditEntity {
  @Column({ name: 'patient_id', type: 'int' })
  patientId!: number;

  @ManyToOne('Patient', 'surgeries', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'encounter_id', type: 'int', nullable: true })
  encounterId!: number | null;

  @ManyToOne('Encounter', 'surgeries', { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter | null;

  @Column({ name: 'catalog_id', type: 'int', nullable: true })
  catalogId!: number | null;

  @ManyToOne('SurgeryCatalog', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'catalog_id' })
  catalog!: SurgeryCatalog;

  @Column({ name: 'surgery_type', type: 'varchar', length: 120 })
  surgeryType!: string;

  @Column({
    name: 'scheduled_date',
    type: 'timestamp without time zone',
    nullable: true,
  })
  scheduledDate!: Date | null;

  @Column({
    name: 'performed_date',
    type: 'timestamp without time zone',
    nullable: true,
  })
  performedDate!: Date | null;

  @Column({
    name: 'surgery_status',
    type: 'enum',
    enum: SurgeryStatusEnum,
    enumName: 'surgery_status_enum',
    default: SurgeryStatusEnum.PROGRAMADA,
  })
  surgeryStatus!: SurgeryStatusEnum;

  @Column({ name: 'is_external', type: 'boolean', default: false })
  isExternal!: boolean;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'postoperative_instructions',
    type: 'text',
    nullable: true,
  })
  postoperativeInstructions!: string | null;
}
