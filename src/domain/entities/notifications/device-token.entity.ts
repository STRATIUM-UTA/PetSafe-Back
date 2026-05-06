import { Entity, Column, Index } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';

@Entity({ name: 'device_tokens' })
export class DeviceToken extends BaseAuditEntity {
  @Column({ name: 'user_id', type: 'int' })
  @Index()
  userId!: number;

  @Column({ name: 'fcm_token', type: 'varchar', length: 512 })
  fcmToken!: string;

  @Column({ name: 'platform', type: 'varchar', length: 20, default: 'android' })
  platform!: string;
}
