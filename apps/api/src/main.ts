import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './core/global-exception.filter';
import { MediaStorageService } from './modules/video/media-storage.service';

export async function configureApp(app: INestApplication) {
  const expressApp = app.getHttpAdapter()?.getInstance?.();
  if (typeof expressApp?.set === 'function') {
    expressApp.set('trust proxy', 1);
  }

  const storage = app.get(MediaStorageService);
  await storage.ensureDirectories();

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(cookieParser());
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Chunk-Index',
      'X-File-Name',
      'X-Title-Ar',
    ],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('BOSLA Academy API (أكاديمية بوصلة)')
    .setDescription(
      'Enterprise Veterinary & Agribusiness LMS REST API — Self-Hosted HLS Video, WebAuthn Passkeys (No OTP), Google OIDC, Paymob Memberships',
    )
    .setVersion('1.0.0')
    .addCookieAuth('bosla_session')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  return app;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await configureApp(app);
  app.enableShutdownHooks();

  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`BOSLA Academy API listening on http://0.0.0.0:${port}/api/v1`);
  console.log(`Swagger docs available at http://0.0.0.0:${port}/api-docs`);
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('Failed to bootstrap BOSLA API:', err);
    process.exit(1);
  });
}
