import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
  await app.listen(process.env.API_PORT ?? 3001);
}
bootstrap();
