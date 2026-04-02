import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './infra/filters/http-exception.filter.js';
import { getCorsConfig } from './infra/config/cors.config.js';
import { ASSETS_ROOT, ensureAssetsDirectories } from './infra/config/uploads.config.js';

async function bootstrap() {
  ensureAssetsDirectories();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
    rawBody: false,
  });

  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const jsonLimit = configService.get<string>('HTTP_JSON_LIMIT', '256kb');
  const urlencodedLimit = configService.get<string>('HTTP_URLENCODED_LIMIT', '256kb');
  const keepAliveTimeout = Number(
    configService.get<string>('HTTP_KEEP_ALIVE_TIMEOUT_MS', '5000'),
  );
  const headersTimeout = Number(
    configService.get<string>('HTTP_HEADERS_TIMEOUT_MS', '6000'),
  );
  const staticMaxAge = configService.get<string>(
    'STATIC_ASSETS_CACHE_MAX_AGE',
    isProduction ? '30d' : '0',
  );

  app.enableCors(getCorsConfig(configService));
  app.useBodyParser('json', { limit: jsonLimit });
  app.useBodyParser('urlencoded', {
    limit: urlencodedLimit,
    extended: true,
  });
  app.useStaticAssets(ASSETS_ROOT, {
    prefix: '/assets/',
    etag: true,
    lastModified: true,
    maxAge: staticMaxAge,
    immutable: isProduction,
  });
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const messages = errors.flatMap((err) => Object.values(err.constraints ?? {}));
        return new BadRequestException({
          statusCode: 400,
          message: messages,
          error: 'Bad Request',
        });
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000);
  const server = app.getHttpServer() as {
    keepAliveTimeout?: number;
    headersTimeout?: number;
  };
  server.keepAliveTimeout = keepAliveTimeout;
  server.headersTimeout = headersTimeout;
  console.log(
    `🐾 PetSafe API running on http://localhost:${process.env.PORT ?? 3000}/api`,
  );
}
bootstrap();
