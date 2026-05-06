import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserNotification } from '../../../domain/entities/notifications/user-notification.entity.js';

@Injectable()
export class UserNotificationService {
  constructor(
    @InjectRepository(UserNotification)
    private readonly repo: Repository<UserNotification>,
  ) {}

  async create(params: {
    userId: number;
    title: string;
    body: string;
    referenceType?: string;
    referenceId?: number;
  }): Promise<UserNotification> {
    const entity = this.repo.create({
      userId: params.userId,
      title: params.title,
      body: params.body,
      referenceType: params.referenceType ?? null,
      referenceId: params.referenceId ?? null,
      readAt: null,
    });
    return this.repo.save(entity);
  }

  async findForUser(userId: number): Promise<UserNotification[]> {
    return this.repo.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async countUnread(userId: number): Promise<number> {
    return this.repo.count({
      where: { userId, isActive: true, readAt: IsNull() },
    });
  }

  async markRead(id: number, userId: number): Promise<void> {
    const notification = await this.repo.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notificacion no encontrada.');
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.repo.save(notification);
    }
  }

  async markAllRead(userId: number): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(UserNotification)
      .set({ readAt: new Date() })
      .where('user_id = :userId AND read_at IS NULL AND is_active = true', { userId })
      .execute();
  }

  async softDelete(id: number, userId: number): Promise<void> {
    const notification = await this.repo.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notificacion no encontrada.');
    notification.isActive = false;
    await this.repo.save(notification);
  }
}
