import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
// .env root monorepo (WA_*, ANTHROPIC_API_KEY, …) lalu .env lokal bila ada
loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DomainErrorFilter } from './common/http';

async function bootstrap() {
  // rawBody wajib utk verifikasi HMAC webhook GoWA
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({ origin: process.env.APP_PUBLIC_WEB_URL ?? 'http://localhost:3000' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new DomainErrorFilter());
  app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
  await app.listen(process.env.API_PORT ?? 3001);
}
bootstrap();
