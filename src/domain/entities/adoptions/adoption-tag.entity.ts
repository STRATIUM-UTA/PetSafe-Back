import { Entity, Column, ManyToMany } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import { Adoption } from './adoption.entity.js';

@Entity({ name: 'adoption_tags' })
export class AdoptionTag extends BaseAuditEntity {
  @Column({ type: 'varchar', length: 80, unique: true })
  name!: string;

  @ManyToMany(() => Adoption, (adoption) => adoption.tags)
  adoptions!: Adoption[];
}
