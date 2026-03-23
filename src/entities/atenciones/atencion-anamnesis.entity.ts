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
  AppetiteStatusEnum,
  WaterIntakeStatusEnum,
} from '../../common/enums/index.js';
import type { Atencion } from './atencion.entity.js';

@Entity({ name: 'atenciones_anamnesis' })
export class AtencionAnamnesis {
  @PrimaryColumn({ name: 'atencion_id', type: 'uuid' })
  atencionId!: string;

  @OneToOne('Atencion', 'anamnesis', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'atencion_id' })
  atencion!: Atencion;

  @Column({ name: 'inicio_problema_texto', type: 'text', nullable: true })
  inicioProblemaTexto!: string | null;

  @Column({ name: 'cirugias_previas_texto', type: 'text', nullable: true })
  cirugiasPreviasTexto!: string | null;

  @Column({ name: 'como_empezo_problema_texto', type: 'text', nullable: true })
  comoEmpezoProblemaTexto!: string | null;

  @Column({ name: 'vacunas_al_dia', type: 'boolean', nullable: true })
  vacunasAlDia!: boolean | null;

  @Column({ name: 'desparasitaciones_al_dia', type: 'boolean', nullable: true })
  desparasitacionesAlDia!: boolean | null;

  @Column({ name: 'hay_mascota_en_casa', type: 'boolean', nullable: true })
  hayMascotaEnCasa!: boolean | null;

  @Column({ name: 'mascota_en_casa_detalle', type: 'text', nullable: true })
  mascotaEnCasaDetalle!: string | null;

  @Column({
    name: 'medicamento_administrado_texto',
    type: 'text',
    nullable: true,
  })
  medicamentoAdministradoTexto!: string | null;

  @Column({
    name: 'come_estado',
    type: 'enum',
    enum: AppetiteStatusEnum,
    enumName: 'appetite_status_enum',
    nullable: true,
  })
  comeEstado!: AppetiteStatusEnum | null;

  @Column({
    name: 'toma_agua_estado',
    type: 'enum',
    enum: WaterIntakeStatusEnum,
    enumName: 'water_intake_status_enum',
    nullable: true,
  })
  tomaAguaEstado!: WaterIntakeStatusEnum | null;

  @Column({ name: 'heces_texto', type: 'text', nullable: true })
  hecesTexto!: string | null;

  @Column({ name: 'vomito_texto', type: 'text', nullable: true })
  vomitoTexto!: string | null;

  @Column({ name: 'numero_deposiciones', type: 'integer', nullable: true })
  numeroDeposiciones!: number | null;

  @Column({ name: 'orina_texto', type: 'text', nullable: true })
  orinaTexto!: string | null;

  @Column({
    name: 'problemas_respiratorios_texto',
    type: 'text',
    nullable: true,
  })
  problemasRespiratoriosTexto!: string | null;

  @Column({ name: 'dificultad_caminar_texto', type: 'text', nullable: true })
  dificultadCaminarTexto!: string | null;

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
