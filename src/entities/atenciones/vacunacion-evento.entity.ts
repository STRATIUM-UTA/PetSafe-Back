import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity.js';
import type { Atencion } from './atencion.entity.js';
import { VacunaCatalogo } from '../catalogos/vacuna-catalogo.entity.js';

@Entity({ name: 'vacunaciones_evento' })
export class VacunacionEvento extends BaseAuditEntity {
  @Column({ name: 'atencion_id', type: 'uuid' })
  atencionId!: string;

  @ManyToOne('Atencion', 'vacunaciones', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'atencion_id' })
  atencion!: Atencion;

  @Column({ name: 'vacuna_id', type: 'uuid' })
  vacunaId!: string;

  @ManyToOne(() => VacunaCatalogo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vacuna_id' })
  vacuna!: VacunaCatalogo;

  @Column({ name: 'fecha_aplicacion', type: 'date' })
  fechaAplicacion!: Date;

  @Column({ name: 'proxima_fecha_sugerida', type: 'date', nullable: true })
  proximaFechaSugerida!: Date | null;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;
}
