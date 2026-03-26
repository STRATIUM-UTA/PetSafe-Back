import { Injectable } from '@nestjs/common';
import { NotificationMessage } from '../../../../presentation/dto/notifications/notification-message.dto.js';

interface PasswordResetPinTemplateInput {
  email: string;
  fullName: string;
  pin: string;
  expiresInMinutes: number;
}

@Injectable()
export class AuthNotificationContentFactory {
  buildPasswordResetPinMessage(
    input: PasswordResetPinTemplateInput,
  ): NotificationMessage {
    const subject = 'Recuperación de contraseña - SafePet';
    const text = [
      `Hola ${input.fullName},`,
      '',
      'Recibimos una solicitud para restablecer tu contraseña en SafePet.',
      `Tu código de verificación es: ${input.pin}`,
      `Este PIN expira en ${input.expiresInMinutes} minutos y solo se puede usar una vez.`,
      'Si no realizaste esta solicitud, puedes ignorar este mensaje.',
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="margin-bottom: 8px;">SafePet</h2>
        <p>Hola ${input.fullName},</p>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p>Usa este PIN de verificación:</p>
        <div style="display: inline-block; padding: 12px 18px; font-size: 28px; font-weight: 700; letter-spacing: 6px; background: #f3f4f6; border-radius: 10px;">
          ${input.pin}
        </div>
        <p style="margin-top: 16px;">Este PIN expira en ${input.expiresInMinutes} minutos y solo se puede usar una vez.</p>
        <p>Si no realizaste esta solicitud, puedes ignorar este mensaje.</p>
      </div>
    `;

    return {
      channel: 'email',
      recipient: {
        email: input.email,
        name: input.fullName,
      },
      subject,
      content: {
        text,
        html,
      },
      metadata: {
        notificationType: 'password_reset_pin',
      },
    };
  }
}
