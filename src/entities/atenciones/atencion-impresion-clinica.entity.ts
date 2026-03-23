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

@Entity({ name: 'atenciones_impresion_clinica' })
export class AtencionImpresionClinica {
  @PrimaryColumn({ name: 'atencion_id', type: 'uuid' })
  atencionId!: string;

  @OneToOne('Atencion', 'impresionClinica', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'atencion_id' })
  atencion!: Atencion;

  @Column({ name: 'diagnostico_presuntivo', type: 'text', nullable: true })
  diagnosticoPresuntivo!: string | null;

  @Column({ name: 'diagnostico_diferencial', type: 'text', nullable: true })
  diagnosticoDiferencial!: string | null;

  @Column({ type: 'text', nullable: true })
  pronostico!: string | null;

  @Column({ name: 'observaciones_clinicas', type: 'text', nullable: true })
  observacionesClinicas!: string | null;

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
