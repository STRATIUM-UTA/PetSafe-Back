import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../infra/security/guards/jwt-auth.guard.js';
import { DeviceTokenService } from '../../../application/services/notifications/device-token.service.js';
import { UserNotificationService } from '../../../application/services/notifications/user-notification.service.js';
import { RegisterDeviceTokenDto } from '../../dto/notifications/register-device-token.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly deviceTokenService: DeviceTokenService,
    private readonly userNotificationService: UserNotificationService,
  ) {}

  @Post('device-token')
  async registerToken(
    @Body() dto: RegisterDeviceTokenDto,
    @Request() req: { user: { userId: number } },
  ): Promise<{ ok: boolean }> {
    await this.deviceTokenService.upsert(req.user.userId, dto.fcmToken, dto.platform ?? 'android');
    return { ok: true };
  }

  @Patch('device-token/remove')
  async removeToken(
    @Body() dto: RegisterDeviceTokenDto,
    @Request() req: { user: { userId: number } },
  ): Promise<{ ok: boolean }> {
    await this.deviceTokenService.remove(req.user.userId, dto.fcmToken);
    return { ok: true };
  }

  @Get('my')
  listMine(@Request() req: { user: { userId: number } }) {
    return this.userNotificationService.findForUser(req.user.userId);
  }

  @Get('my/unread-count')
  async unreadCount(
    @Request() req: { user: { userId: number } },
  ): Promise<{ count: number }> {
    const count = await this.userNotificationService.countUnread(req.user.userId);
    return { count };
  }

  @Patch(':id/read')
  async markRead(
    @Param('id') id: string,
    @Request() req: { user: { userId: number } },
  ): Promise<{ ok: boolean }> {
    await this.userNotificationService.markRead(+id, req.user.userId);
    return { ok: true };
  }

  @Patch('read-all')
  async markAllRead(
    @Request() req: { user: { userId: number } },
  ): Promise<{ ok: boolean }> {
    await this.userNotificationService.markAllRead(req.user.userId);
    return { ok: true };
  }

  @Delete(':id')
  async deleteNotification(
    @Param('id') id: string,
    @Request() req: { user: { userId: number } },
  ): Promise<{ ok: boolean }> {
    await this.userNotificationService.softDelete(+id, req.user.userId);
    return { ok: true };
  }
}
