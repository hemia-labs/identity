import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithRequestId = Request & {
  requestId: string;
};

export const requestContextMiddleware = (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  const requestIdHeader = request.header('x-request-id');
  const requestId =
    requestIdHeader && requestIdHeader.length <= 128
      ? requestIdHeader
      : randomUUID();

  (request as RequestWithRequestId).requestId = requestId;
  response.setHeader('x-request-id', requestId);

  const startedAt = Date.now();
  response.on('finish', () => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'log',
        context: 'HTTP',
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      }),
    );
  });

  next();
};
