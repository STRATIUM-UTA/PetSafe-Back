import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity.js';
import type { EspecieCatalogo } from './especie-catalogo.entity.js';

@Entity({ name: 'razas_catalogo' })
export class RazaCatalogo extends BaseAuditEntity {
  @Column({ name: 'especie_id', type: 'uuid' })
  especieId!: string;

  @ManyToOne('EspecieCatalogo', 'razas', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'especie_id' })
  especie!: EspecieCatalogo;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion!: string | null;
}
