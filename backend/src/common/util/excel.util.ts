/**
 * Helper hỗ trợ xử lý file Excel
 */
export class ExcelUtil {
  static validateHeaders(actualHeaders: string[], requiredHeaders: string[]): boolean {
    const lowerActual = actualHeaders.map((h) => (h || '').trim().toLowerCase());
    return requiredHeaders.every((req) => lowerActual.includes(req.toLowerCase()));
  }
}
