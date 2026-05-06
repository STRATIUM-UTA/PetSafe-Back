import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NOTIFICATION_CHANNELS } from '../../../domain/constants/notification.constants.js';
import { DeviceToken } from '../../../domain/entities/notifications/device-token.entity.js';
import { UserNotification } from '../../../domain/entities/notifications/user-notification.entity.js';
import { UserNotificationService } from '../../services/notifications/user-notification.service.js';
import { NotificationDispatcherService } from '../../services/notifications/notification-dispatcher.service.js';
import { EmailNotificationChannelService } from '../../services/notifications/channels/email-notification-channel.service.js';
import { AuthNotificationContentFactory } from '../../services/notifications/templates/auth-notification-content.factory.js';
import { FcmPushService } from '../../services/notifications/fcm-push.service.js';
import { DeviceTokenService } from '../../services/notifications/device-token.service.js';
import { NotificationsGateway } from '../../services/notifications/notifications.gateway.js';
import { NotificationsController } from '../../../presentation/controllers/notifications/notifications.controller.js';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([DeviceToken, UserNotification])],
  controllers: [NotificationsController],
  providers: [
    EmailNotificationChannelService,
    AuthNotificationContentFactory,
    NotificationDispatcherService,
    FcmPushService,
    DeviceTokenService,
    UserNotificationService,
    NotificationsGateway,
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (emailChannel: EmailNotificationChannelService) => [emailChannel],
      inject: [EmailNotificationChannelService],
    },
  ],
  exports: [
    NotificationDispatcherService,
    AuthNotificationContentFactory,
    FcmPushService,
    DeviceTokenService,
    UserNotificationService,
    NotificationsGateway,
  ],
})
export class NotificationsModule {}
