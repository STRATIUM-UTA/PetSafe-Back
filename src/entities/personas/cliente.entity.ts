import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity.js';
import { Persona } from './persona.entity.js';
import type { PacienteTutor } from '../pacientes/paciente-tutor.entity.js';

@Entity({ name: 'clientes' })
export class Cliente extends BaseAuditEntity {
  @Column({ name: 'persona_id', type: 'uuid' })
  personaId!: string;

  @ManyToOne(() => Persona, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'persona_id' })
  persona!: Persona;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @OneToMany('PacienteTutor', 'cliente')
  pacientesTutores!: PacienteTutor[];
}
