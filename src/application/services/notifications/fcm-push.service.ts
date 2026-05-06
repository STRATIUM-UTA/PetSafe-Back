import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

@Injectable()
export class FcmPushService implements OnModuleInit {
  private readonly logger = new Logger(FcmPushService.name);
  private app: App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const credentialsPath = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    if (!credentialsPath) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT_PATH no configurado. Push notifications deshabilitadas.');
      return;
    }

    try {
      if (!getApps().length) {
        const serviceAccount = JSON.parse(
          readFileSync(resolve(credentialsPath), 'utf8'),
        );
        this.app = initializeApp({ credential: cert(serviceAccount) });
      } else {
        this.app = getApps()[0]!;
      }
      this.logger.log('Firebase Admin inicializado correctamente.');
    } catch (error) {
      this.logger.error('Error inicializando Firebase Admin', error);
    }
  }

  async sendToToken(params: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    if (!this.app) return;

    try {
      await getMessaging(this.app).send({
        token: params.token,
        notification: { title: params.title, body: params.body },
        data: params.data,
        android: { priority: 'high' },
      });
    } catch (error) {
      this.logger.warn(`No se pudo enviar push al token: ${params.token}`, error);
    }
  }

  async sendToTokens(params: {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    if (!this.app || params.tokens.length === 0) return;

    const chunks = this._chunk(params.tokens, 500);
    for (const chunk of chunks) {
      try {
        await getMessaging(this.app).sendEachForMulticast({
          tokens: chunk,
          notification: { title: params.title, body: params.body },
          data: params.data,
          android: { priority: 'high' },
        });
      } catch (error) {
        this.logger.warn('Error enviando push multicast', error);
      }
    }
  }

  private _chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }
}
