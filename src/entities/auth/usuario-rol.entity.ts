import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
  CreateDateColumn,
} from 'typeorm';
import type { Usuario } from './usuario.entity.js';
import type { Role } from './role.entity.js';

@Entity({ name: 'usuarios_roles' })
export class UsuarioRol {
  @PrimaryColumn({ name: 'usuario_id', type: 'int' })
  usuarioId!: number ;

  @PrimaryColumn({ name: 'rol_id', type: 'int' })
  rolId!: number ;

  @CreateDateColumn({
    name: 'assigned_at',
    type: 'timestamp without time zone',
  })
  assignedAt!: Date;

  @ManyToOne('Usuario', 'usuariosRoles', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @ManyToOne('Role', 'usuariosRoles', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rol_id' })
  rol!: Role;
}
