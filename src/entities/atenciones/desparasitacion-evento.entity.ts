import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity.js';
import type { Atencion } from './atencion.entity.js';
import { AntiparasitarioCatalogo } from '../catalogos/antiparasitario-catalogo.entity.js';

@Entity({ name: 'desparasitaciones_evento' })
export class DesparasitacionEvento extends BaseAuditEntity {
  @Column({ name: 'atencion_id', type: 'uuid' })
  atencionId!: string;

  @ManyToOne('Atencion', 'desparasitaciones', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'atencion_id' })
  atencion!: Atencion;

  @Column({ name: 'producto_id', type: 'uuid' })
  productoId!: string;

  @ManyToOne(() => AntiparasitarioCatalogo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'producto_id' })
  producto!: AntiparasitarioCatalogo;

  @Column({ name: 'fecha_aplicacion', type: 'date' })
  fechaAplicacion!: Date;

  @Column({ name: 'proxima_fecha_sugerida', type: 'date', nullable: true })
  proximaFechaSugerida!: Date | null;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;
}
