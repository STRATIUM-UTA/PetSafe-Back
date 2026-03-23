import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity.js';

@Entity({ name: 'usuarios_refresh_tokens' })
export class UsuarioRefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @ManyToOne(() => Usuario, (u) => u.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @Column({ name: 'token_hash', type: 'varchar', length: 255 })
  tokenHash!: string;

  @Column({
    name: 'expires_at',
    type: 'timestamp without time zone',
  })
  expiresAt!: Date;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @Column({
    name: 'revoked_at',
    type: 'timestamp without time zone',
    nullable: true,
  })
  revokedAt!: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp without time zone',
  })
  createdAt!: Date;

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
