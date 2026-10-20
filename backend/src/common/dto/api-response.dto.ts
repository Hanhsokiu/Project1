/**
 * Chuẩn response cho mọi API endpoint
 */
export class ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;

  constructor(data: T, message?: string) {
    this.success = true;
    this.data = data;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }

  static ok<T>(data: T, message?: string): ApiResponse<T> {
    return new ApiResponse(data, message);
  }

  static error(message: string): ApiResponse<null> {
    const res = new ApiResponse<null>(null, message);
    res.success = false;
    return res;
  }
}
