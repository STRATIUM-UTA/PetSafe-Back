import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';
import { ConfigService } from '@nestjs/config';

export const getCorsConfig = (configService: ConfigService): CorsOptions => {
  const isDevelopment = configService.get<string>('NODE_ENV') === 'development';

  if (isDevelopment) {
    return {
      origin: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
      allowedHeaders: 'Content-Type, Authorization, Accept, X-Requested-With, Origin',
    };
  }

  return {
    origin: configService.get<string>('FRONTEND_URL') || 'https://midominio.com',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  };
};
