import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import { VaccinationSchemeVersionStatusEnum } from '../../enums/index.js';
import type { VaccinationScheme } from './vaccination-scheme.entity.js';
import type { VaccinationSchemeVersionDose } from './vaccination-scheme-version-dose.entity.js';
import type { PatientVaccinationPlan } from './patient-vaccination-plan.entity.js';

@Entity({ name: 'vaccination_scheme_versions' })
export class VaccinationSchemeVersion extends BaseAuditEntity {
  @Column({ name: 'scheme_id', type: 'int' })
  schemeId!: number;

  @ManyToOne('VaccinationScheme', 'versions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheme_id' })
  scheme!: VaccinationScheme;

  @Column({ type: 'integer' })
  version!: number;

  @Column({
    type: 'enum',
    enum: VaccinationSchemeVersionStatusEnum,
    enumName: 'vaccination_scheme_version_status_enum',
    default: VaccinationSchemeVersionStatusEnum.VIGENTE,
  })
  status!: VaccinationSchemeVersionStatusEnum;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom!: Date;

  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo!: Date | null;

  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason!: string | null;

  @Column({ name: 'revaccination_rule', type: 'varchar', length: 120, nullable: true })
  revaccinationRule!: string | null;

  @Column({ name: 'general_interval_days', type: 'int', nullable: true })
  generalIntervalDays!: number | null;

  @OneToMany('VaccinationSchemeVersionDose', 'schemeVersion')
  doses!: VaccinationSchemeVersionDose[];

  @OneToMany('PatientVaccinationPlan', 'schemeVersion')
  patientPlans!: PatientVaccinationPlan[];
}
