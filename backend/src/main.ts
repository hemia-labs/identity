import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.bootstrap';
import { JsonLogger } from './common/logging/json.logger';

async function bootstrap() {
  const logger = new JsonLogger();
  const app = await NestFactory.create(AppModule);
  const { port } = configureApp(app, logger);
  await app.listen(port);
}
bootstrap();
