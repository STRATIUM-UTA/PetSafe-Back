import { Entity, Column, Index } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';

@Entity({ name: 'user_notifications' })
export class UserNotification extends BaseAuditEntity {
  @Column({ name: 'user_id', type: 'int' })
  @Index()
  userId!: number;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'reference_type', type: 'varchar', length: 60, nullable: true })
  referenceType!: string | null;

  @Column({ name: 'reference_id', type: 'int', nullable: true })
  referenceId!: number | null;

  @Column({ name: 'read_at', type: 'timestamp without time zone', nullable: true })
  readAt!: Date | null;
}
