import { Entity, Column, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import { AdoptionStatusEnum } from '../../enums/index.js';
import type { Patient } from '../patients/patient.entity.js';
import type { Client } from '../persons/client.entity.js';
import { AdoptionTag } from './adoption-tag.entity.js';

@Entity({ name: 'adoptions' })
export class Adoption extends BaseAuditEntity {
  @Column({ name: 'patient_id', type: 'int' })
  patientId!: number;

  @ManyToOne('Patient', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({
    type: 'enum',
    enum: AdoptionStatusEnum,
    enumName: 'adoption_status_enum',
    default: AdoptionStatusEnum.DISPONIBLE,
  })
  status!: AdoptionStatusEnum;

  @Column({ name: 'story', type: 'text', nullable: true })
  story!: string | null;

  @Column({ name: 'requirements', type: 'text', nullable: true })
  requirements!: string | null;

  @Column({ name: 'adopter_client_id', type: 'int', nullable: true })
  adopterClientId!: number | null;

  @ManyToOne('Client', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'adopter_client_id' })
  adopterClient!: Client | null;

  @Column({ name: 'adoption_date', type: 'date', nullable: true })
  adoptionDate!: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'contact_name', type: 'varchar', length: 120, nullable: true })
  contactName!: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 25, nullable: true })
  contactPhone!: string | null;

  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contactEmail!: string | null;

  @ManyToMany(() => AdoptionTag, (tag) => tag.adoptions)
  @JoinTable({
    name: 'adoption_tag_assignments',
    joinColumn: { name: 'adoption_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags!: AdoptionTag[];
}
