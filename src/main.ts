import 'dotenv/config';
// Global BigInt serialization fix — BigInt không serialize được JSON mặc định
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { correlationIdMiddleware } from './common/middleware/correlation-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Correlation ID — trace requests across logs
  app.use(correlationIdMiddleware);

  // Increase body size limit for large planning payloads
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  // Security
  app.use(helmet());

  // CORS - read allowed origins from .env
  const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global exception filter — standardized error responses with proper status codes
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global response interceptor — standardized success responses
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger API Documentation — disable on production
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('DAFC OTB Planning API')
      .setDescription('Open-To-Buy Planning Management System for Luxury Fashion')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication & Authorization')
      .addTag('master-data', 'Brands, Stores, Collections, Categories, SKU Catalog')
      .addTag('budgets', 'Budget Management')
      .addTag('planning', 'OTB Planning & Versions')
      .addTag('proposals', 'SKU Proposals')
      .addTag('approvals', 'Approval Workflow')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Graceful shutdown — allow Prisma to disconnect cleanly on SIGTERM/SIGINT
  app.enableShutdownHooks();

  const port = process.env.PORT || 4000;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);

  logger.log(`DAFC OTB Backend API running on http://${host}:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger docs: http://${host}:${port}/api/docs`);
  }
}

bootstrap();
