import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { JsonLogger } from './common/logging/json.logger';
import { requestContextMiddleware } from './common/middleware/request-context.middleware';

export const configureApp = (
  app: INestApplication,
  logger = new JsonLogger(),
) => {
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const env = configService.get<string>('app.env', 'development');
  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);

  if (env === 'production' && corsOrigins.length === 0) {
    throw new Error('APP_CORS_ORIGINS is required in production');
  }

  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: '.well-known/openid-configuration', method: RequestMethod.GET },
      { path: '.well-known/jwks.json', method: RequestMethod.GET },
      { path: 'oauth/(.*)', method: RequestMethod.ALL },
      { path: 'oidc/(.*)', method: RequestMethod.ALL },
    ],
  });
  // app.use(requestContextMiddleware);
  app.use(cookieParser());
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  return { port };
};
