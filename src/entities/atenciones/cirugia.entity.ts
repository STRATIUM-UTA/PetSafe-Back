import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity.js';
import { SurgeryStatusEnum } from '../../common/enums/index.js';
import type { Atencion } from './atencion.entity.js';

@Entity({ name: 'cirugias' })
export class Cirugia extends BaseAuditEntity {
  @Column({ name: 'atencion_id', type: 'uuid' })
  atencionId!: string;

  @ManyToOne('Atencion', 'cirugias', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'atencion_id' })
  atencion!: Atencion;

  @Column({ name: 'tipo_cirugia', type: 'varchar', length: 120 })
  tipoCirugia!: string;

  @Column({
    name: 'fecha_programada',
    type: 'timestamp without time zone',
    nullable: true,
  })
  fechaProgramada!: Date | null;

  @Column({
    name: 'fecha_realizada',
    type: 'timestamp without time zone',
    nullable: true,
  })
  fechaRealizada!: Date | null;

  @Column({
    name: 'estado_cirugia',
    type: 'enum',
    enum: SurgeryStatusEnum,
    enumName: 'surgery_status_enum',
    default: SurgeryStatusEnum.PROGRAMADA,
  })
  estadoCirugia!: SurgeryStatusEnum;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({
    name: 'indicaciones_postoperatorias',
    type: 'text',
    nullable: true,
  })
  indicacionesPostoperatorias!: string | null;
}
