import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const bodyMessage = this.resolveMessage(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    const responseMessage = Array.isArray(bodyMessage)
      ? bodyMessage.join(', ')
      : bodyMessage;

    const reqId =
      typeof request.id === 'string' || typeof request.id === 'number'
        ? String(request.id)
        : undefined;

    this.logger.error(
      `[${reqId ?? 'no-req-id'}] ${request.method} ${request.url} → ${status} — ${responseMessage}`,
      stack,
    );

    response.status(status).json({
      statusCode: status,
      message: responseMessage,
      path: request.url,
      ...(reqId ? { requestId: reqId } : {}),
      ...(process.env.NODE_ENV !== 'production' && stack ? { stack } : {}),
    });
  }

  private resolveMessage(exception: unknown): string | string[] {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return res;
      }
      if (typeof res === 'object' && res !== null && 'message' in res) {
        const msg = (res as { message: string | string[] }).message;
        return msg ?? exception.message;
      }
      return exception.message;
    }
    if (exception instanceof Error) {
      return exception.message;
    }
    return 'Internal server error';
  }
}
