import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from './request-id.middleware.js';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const requestId = request.requestId || (request.headers['x-request-id'] as string) || undefined;
    const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        code = status === HttpStatus.TOO_MANY_REQUESTS ? 'RATE_LIMIT_EXCEEDED' : 'HTTP_ERROR';
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        code = (obj.code as string) || (obj.error as string) || (status === HttpStatus.TOO_MANY_REQUESTS ? 'RATE_LIMIT_EXCEEDED' : 'HTTP_ERROR');
        message = (obj.message as string) || message;
        if (Array.isArray(obj.message)) {
          message = obj.message.join('; ');
        }
        details = obj.details;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        JSON.stringify({
          msg: 'unhandled_exception',
          requestId,
          path: request.url,
          method: request.method,
          error: exception.message,
          stack: isProduction ? undefined : exception.stack,
        }),
      );

      // In production, do not leak internal database / system errors
      if (isProduction) {
        message = 'Internal server error';
        code = 'INTERNAL_ERROR';
      } else {
        message = exception.message;
        code = (exception as Error & { code?: string }).code || 'INTERNAL_ERROR';
      }
    }

    const payload: Record<string, unknown> = {
      statusCode: status,
      code,
      message,
      requestId,
      timestamp: new Date().toISOString(),
    };

    if (details !== undefined && !isProduction) {
      payload.details = details;
    }

    response.status(status).json(payload);
  }
}
