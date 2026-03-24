import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity.js';

@Entity({ name: 'usuarios_password_reset_tokens' })
export class UsuarioPasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @Column({ name: 'code_hash', type: 'varchar', length: 255 })
  codeHash!: string;

  @Column({ name: 'channel', type: 'varchar', length: 30, default: 'email' })
  channel!: string;

  @Column({ name: 'destination', type: 'varchar', length: 255 })
  destination!: string;

  @Column({
    name: 'expires_at',
    type: 'timestamp without time zone',
  })
  expiresAt!: Date;

  @Column({
    name: 'used_at',
    type: 'timestamp without time zone',
    nullable: true,
  })
  usedAt!: Date | null;

  @Column({
    name: 'invalidated_at',
    type: 'timestamp without time zone',
    nullable: true,
  })
  invalidatedAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ name: 'max_attempts', type: 'integer', default: 5 })
  maxAttempts!: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp without time zone',
  })
  createdAt!: Date;
}
