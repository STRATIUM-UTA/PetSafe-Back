import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import type { Atencion } from './atencion.entity.js';

@Entity({ name: 'atenciones_motivo_consulta' })
export class AtencionMotivoConsulta {
  @PrimaryColumn({ name: 'atencion_id', type: 'uuid' })
  atencionId!: string;

  @OneToOne('Atencion', 'motivoConsulta', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'atencion_id' })
  atencion!: Atencion;

  @Column({ name: 'motivo_consulta', type: 'text' })
  motivoConsulta!: string;

  @Column({
    name: 'antecedente_enfermedad_actual',
    type: 'text',
    nullable: true,
  })
  antecedenteEnfermedadActual!: string | null;

  @Column({
    name: 'diagnosticos_anteriores_referidos',
    type: 'text',
    nullable: true,
  })
  diagnosticosAnterioresReferidos!: string | null;

  @Column({
    name: 'tratamientos_anteriores_referidos',
    type: 'text',
    nullable: true,
  })
  tratamientosAnterioresReferidos!: string | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp without time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp without time zone' })
  updatedAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp without time zone',
    nullable: true,
  })
  deletedAt!: Date | null;

  @Column({ name: 'deleted_by_usuario_id', type: 'uuid', nullable: true })
  deletedByUsuarioId!: string | null;
}
