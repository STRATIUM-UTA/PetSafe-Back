import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity.js';
import { Persona } from './persona.entity.js';

@Entity({ name: 'empleados' })
export class Empleado extends BaseAuditEntity {
  @Column({ name: 'persona_id', type: 'uuid' })
  personaId!: string;

  @ManyToOne(() => Persona, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'persona_id' })
  persona!: Persona;

  @Column({ type: 'varchar', length: 40, nullable: true })
  codigo!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  cargo!: string | null;

  @Column({
    name: 'numero_registro_profesional',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  numeroRegistroProfesional!: string | null;

  @Column({ name: 'es_mvz', type: 'boolean', default: false })
  esMvz!: boolean;

  @Column({
    name: 'fecha_ingreso',
    type: 'date',
    nullable: true,
  })
  fechaIngreso!: Date | null;
}
