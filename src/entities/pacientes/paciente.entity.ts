import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity.js';
import { PatientSexEnum } from '../../common/enums/index.js';
import { EspecieCatalogo } from '../catalogos/especie-catalogo.entity.js';
import { RazaCatalogo } from '../catalogos/raza-catalogo.entity.js';
import { ColorCatalogo } from '../catalogos/color-catalogo.entity.js';
import type { PacienteTutor } from './paciente-tutor.entity.js';
import type { PacienteCondicion } from './paciente-condicion.entity.js';

@Entity({ name: 'pacientes' })
export class Paciente extends BaseAuditEntity {
  @Column({ type: 'varchar', length: 40, nullable: true })
  codigo!: string | null;

  @Column({ type: 'varchar', length: 120 })
  nombre!: string;

  @Column({ name: 'especie_id', type: 'uuid' })
  especieId!: string;

  @ManyToOne(() => EspecieCatalogo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'especie_id' })
  especie!: EspecieCatalogo;

  @Column({ name: 'raza_id', type: 'uuid', nullable: true })
  razaId!: string | null;

  @ManyToOne(() => RazaCatalogo, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'raza_id' })
  raza!: RazaCatalogo | null;

  @Column({ name: 'color_id', type: 'uuid', nullable: true })
  colorId!: string | null;

  @ManyToOne(() => ColorCatalogo, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'color_id' })
  color!: ColorCatalogo | null;

  @Column({
    type: 'enum',
    enum: PatientSexEnum,
    enumName: 'patient_sex_enum',
  })
  sexo!: PatientSexEnum;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento!: Date | null;

  @Column({
    name: 'peso_actual',
    type: 'numeric',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  pesoActual!: number | null;

  @Column({ type: 'boolean', default: false })
  esterilizado!: boolean;

  @Column({
    name: 'microchip_codigo',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  microchipCodigo!: string | null;

  @Column({ name: 'senas_particulares', type: 'text', nullable: true })
  senasParticulares!: string | null;

  @Column({ name: 'alergias_generales', type: 'text', nullable: true })
  alergiasGenerales!: string | null;

  @Column({ name: 'antecedentes_generales', type: 'text', nullable: true })
  antecedentesGenerales!: string | null;

  @OneToMany('PacienteTutor', 'paciente')
  tutores!: PacienteTutor[];

  @OneToMany('PacienteCondicion', 'paciente')
  condiciones!: PacienteCondicion[];
}
