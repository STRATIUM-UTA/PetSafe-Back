import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity.js';
import {
  MediaOwnerTypeEnum,
  MediaTypeEnum,
  StorageProviderEnum,
} from '../../common/enums/index.js';
import { Usuario } from '../auth/usuario.entity.js';

@Entity({ name: 'archivos_media' })
export class ArchivoMedia extends BaseAuditEntity {
  @Column({
    name: 'owner_type',
    type: 'enum',
    enum: MediaOwnerTypeEnum,
    enumName: 'media_owner_type_enum',
  })
  ownerType!: MediaOwnerTypeEnum;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Column({
    name: 'tipo_media',
    type: 'enum',
    enum: MediaTypeEnum,
    enumName: 'media_type_enum',
  })
  tipoMedia!: MediaTypeEnum;

  @Column({
    type: 'enum',
    enum: StorageProviderEnum,
    enumName: 'storage_provider_enum',
  })
  provider!: StorageProviderEnum;

  @Column({ type: 'text' })
  url!: string;

  @Column({ name: 'key_storage', type: 'varchar', length: 255, nullable: true })
  keyStorage!: string | null;

  @Column({ name: 'nombre_original', type: 'varchar', length: 255 })
  nombreOriginal!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 120, nullable: true })
  mimeType!: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes!: number | null;

  @Column({ type: 'integer', nullable: true })
  ancho!: number | null;

  @Column({ type: 'integer', nullable: true })
  alto!: number | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @Column({ name: 'created_by_usuario_id', type: 'uuid', nullable: true })
  createdByUsuarioId!: string | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_usuario_id' })
  createdByUsuario!: Usuario | null;
}
