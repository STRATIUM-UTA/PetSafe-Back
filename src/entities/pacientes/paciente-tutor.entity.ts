import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
  CreateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import type { Paciente } from './paciente.entity.js';
import type { Cliente } from '../personas/cliente.entity.js';

@Entity({ name: 'pacientes_tutores' })
export class PacienteTutor {
  @PrimaryColumn({ name: 'paciente_id', type: 'uuid' })
  pacienteId!: string;

  @PrimaryColumn({ name: 'cliente_id', type: 'uuid' })
  clienteId!: string;

  @Column({ name: 'es_principal', type: 'boolean', default: false })
  esPrincipal!: boolean;

  @Column({
    name: 'parentesco_o_relacion',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  parentescoORelacion!: string | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp without time zone',
  })
  createdAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp without time zone',
    nullable: true,
  })
  deletedAt!: Date | null;

  @Column({ name: 'deleted_by_usuario_id', type: 'uuid', nullable: true })
  deletedByUsuarioId!: string | null;

  @ManyToOne('Paciente', 'tutores', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paciente_id' })
  paciente!: Paciente;

  @ManyToOne('Cliente', 'pacientesTutores', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cliente_id' })
  cliente!: Cliente;
}
