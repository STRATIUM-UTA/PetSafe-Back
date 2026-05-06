import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from '../../../domain/entities/notifications/device-token.entity.js';

@Injectable()
export class DeviceTokenService {
  constructor(
    @InjectRepository(DeviceToken)
    private readonly repo: Repository<DeviceToken>,
  ) {}

  async upsert(userId: number, fcmToken: string, platform = 'android'): Promise<void> {
    const existing = await this.repo.findOne({ where: { userId, fcmToken } });
    if (existing) {
      existing.updatedAt = new Date();
      await this.repo.save(existing);
      return;
    }
    await this.repo.save(this.repo.create({ userId, fcmToken, platform }));
  }

  async getTokensForUser(userId: number): Promise<string[]> {
    const rows = await this.repo.find({ where: { userId, isActive: true } });
    return rows.map((r) => r.fcmToken);
  }

  async getTokensForUsers(userIds: number[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await this.repo
      .createQueryBuilder('dt')
      .where('dt.user_id IN (:...userIds)', { userIds })
      .andWhere('dt.is_active = true')
      .getMany();
    return rows.map((r) => r.fcmToken);
  }

  async remove(userId: number, fcmToken: string): Promise<void> {
    await this.repo.delete({ userId, fcmToken });
  }
}
