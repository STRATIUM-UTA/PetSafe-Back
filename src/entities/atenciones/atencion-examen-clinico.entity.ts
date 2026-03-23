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
import {
  MucosaStatusEnum,
  HydrationStatusEnum,
} from '../../common/enums/index.js';
import type { Atencion } from './atencion.entity.js';

@Entity({ name: 'atenciones_examen_clinico' })
export class AtencionExamenClinico {
  @PrimaryColumn({ name: 'atencion_id', type: 'uuid' })
  atencionId!: string;

  @OneToOne('Atencion', 'examenClinico', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'atencion_id' })
  atencion!: Atencion;

  @Column({
    name: 'peso_kg',
    type: 'numeric',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  pesoKg!: number | null;

  @Column({
    name: 'temperatura_c',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  temperaturaC!: number | null;

  @Column({ type: 'integer', nullable: true })
  pulso!: number | null;

  @Column({ name: 'frecuencia_cardiaca', type: 'integer', nullable: true })
  frecuenciaCardiaca!: number | null;

  @Column({ name: 'frecuencia_respiratoria', type: 'integer', nullable: true })
  frecuenciaRespiratoria!: number | null;

  @Column({
    type: 'enum',
    enum: MucosaStatusEnum,
    enumName: 'mucosa_status_enum',
    nullable: true,
  })
  mucosas!: MucosaStatusEnum | null;

  @Column({
    name: 'ganglios_linfaticos',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  gangliosLinfaticos!: string | null;

  @Column({
    type: 'enum',
    enum: HydrationStatusEnum,
    enumName: 'hydration_status_enum',
    nullable: true,
  })
  hidratacion!: HydrationStatusEnum | null;

  @Column({ name: 'tllc_segundos', type: 'integer', nullable: true })
  tllcSegundos!: number | null;

  @Column({ name: 'observaciones_examen', type: 'text', nullable: true })
  observacionesExamen!: string | null;

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
