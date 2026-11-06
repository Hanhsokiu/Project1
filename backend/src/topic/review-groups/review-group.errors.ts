import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
export function groupError(
  status: number,
  code: string,
  message: string,
): never {
  throw new HttpException(
    {
      success: false,
      error: { code, message },
      timestamp: new Date().toISOString(),
    },
    status,
  );
}
@Catch()
export class ReviewGroupExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    if (error instanceof HttpException) {
      const body = error.getResponse();
      if (typeof body === 'object' && 'success' in body)
        return response.status(error.getStatus()).json(body);
      return response
        .status(error.getStatus())
        .json({
          success: false,
          error: {
            code: error.getStatus() === 401 ? 'AUTH_003' : 'AUTH_004',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        });
    }
    return response
      .status(500)
      .json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Không thể xử lý yêu cầu.' },
        timestamp: new Date().toISOString(),
      });
  }
}
