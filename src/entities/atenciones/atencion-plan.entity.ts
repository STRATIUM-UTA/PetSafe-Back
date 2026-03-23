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

@Entity({ name: 'atenciones_plan' })
export class AtencionPlan {
  @PrimaryColumn({ name: 'atencion_id', type: 'uuid' })
  atencionId!: string;

  @OneToOne('Atencion', 'plan', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'atencion_id' })
  atencion!: Atencion;

  @Column({ name: 'plan_clinico', type: 'text', nullable: true })
  planClinico!: string | null;

  @Column({ name: 'requiere_proxima_cita', type: 'boolean', default: false })
  requiereProximaCita!: boolean;

  @Column({ name: 'fecha_sugerida_proxima_cita', type: 'date', nullable: true })
  fechaSugeridaProximaCita!: Date | null;

  @Column({ name: 'observaciones_plan', type: 'text', nullable: true })
  observacionesPlan!: string | null;

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
