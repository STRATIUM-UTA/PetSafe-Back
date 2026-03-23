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

@Entity({ name: 'atenciones_datos_medioambientales' })
export class AtencionDatosMedioambientales {
  @PrimaryColumn({ name: 'atencion_id', type: 'uuid' })
  atencionId!: string;

  @OneToOne('Atencion', 'datosMedioambientales', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'atencion_id' })
  atencion!: Atencion;

  @Column({ name: 'entorno_texto', type: 'text', nullable: true })
  entornoTexto!: string | null;

  @Column({ name: 'nutricion_texto', type: 'text', nullable: true })
  nutricionTexto!: string | null;

  @Column({ name: 'estilo_vida_texto', type: 'text', nullable: true })
  estiloVidaTexto!: string | null;

  @Column({ name: 'tipo_alimentacion_texto', type: 'text', nullable: true })
  tipoAlimentacionTexto!: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

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
