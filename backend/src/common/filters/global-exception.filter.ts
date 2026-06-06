import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JsonLogger } from '../logging/json.logger';
import { RequestWithRequestId } from '../middleware/request-context.middleware';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: JsonLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithRequestId>();
    const response = context.getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = this.getMessage(exceptionResponse, exception);
    const requestId = request.requestId;

    this.logger.error(
      {
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode,
        message,
      },
      exception instanceof Error ? exception.stack : undefined,
      'ExceptionFilter',
    );

    response.status(statusCode).json({
      statusCode,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }

  private getMessage(response: unknown, exception: unknown) {
    if (typeof response === 'string') {
      return response;
    }

    if (
      response &&
      typeof response === 'object' &&
      'message' in response &&
      typeof response.message === 'string'
    ) {
      return response.message;
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Internal server error';
  }
}
