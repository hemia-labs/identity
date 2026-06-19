import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { UnauthorizedError, ConfigError } from '../core/index';
import type { Response } from 'express';

/**
 * Mapea los errores del núcleo (independientes del framework) a respuestas HTTP:
 * {@link UnauthorizedError} → 401, {@link ConfigError} → 500.
 */
@Catch(UnauthorizedError, ConfigError)
export class SsoExceptionFilter implements ExceptionFilter {
  catch(err: Error, host: ArgumentsHost) {
    const status = err instanceof UnauthorizedError ? 401 : 500;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: err.message });
  }
}
