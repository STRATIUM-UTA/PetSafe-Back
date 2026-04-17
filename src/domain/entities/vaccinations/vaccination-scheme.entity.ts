import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import type { Species } from '../catalogs/species.entity.js';
import type { VaccinationSchemeVersion } from './vaccination-scheme-version.entity.js';

@Entity({ name: 'vaccination_schemes' })
export class VaccinationScheme extends BaseAuditEntity {
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'species_id', type: 'int' })
  speciesId!: number;

  @ManyToOne('Species', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'species_id' })
  species!: Species;

  @OneToMany('VaccinationSchemeVersion', 'scheme')
  versions!: VaccinationSchemeVersion[];
}
