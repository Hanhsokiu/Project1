import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCode } from "./error-code.enum";

export class BusinessException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        success: false,
        error: { code, message },
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }
}
