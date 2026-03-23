import {
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export abstract class BaseAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp without time zone',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp without time zone',
  })
  updatedAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp without time zone',
    nullable: true,
  })
  deletedAt!: Date | null;

  @Column({
    name: 'deleted_by_usuario_id',
    type: 'uuid',
    nullable: true,
  })
  deletedByUsuarioId!: string | null;
}
