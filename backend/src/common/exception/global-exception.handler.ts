import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionHandler implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionHandler.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } };

    this.logger.error(`${request.method} ${request.url} ${status}`, exception instanceof Error ? exception.stack : undefined);

    response.status(status).json({
      ...((typeof body === 'object' ? body : { message: body }) as object),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
