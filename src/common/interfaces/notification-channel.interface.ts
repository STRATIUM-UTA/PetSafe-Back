import { NotificationMessage } from '../../dto/notifications/notification-message.dto.js';

export interface NotificationChannel {
  supports(channel: NotificationMessage['channel']): boolean;
  send(message: NotificationMessage): Promise<void>;
}
