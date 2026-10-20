/**
 * Helper hỗ trợ sinh và cấu hình file PDF
 */
export class PdfUtil {
  static getStandardHeader(title: string): string {
    return `
      <div style="text-align: center; font-family: 'Times New Roman', serif;">
        <p style="margin: 0; font-size: 13pt; font-weight: bold;">TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI</p>
        <p style="margin: 0; font-size: 13pt; font-weight: bold;">KHOA CÔNG NGHỆ THÔNG TIN</p>
        <hr style="width: 30%; margin: 8px auto;" />
        <h2 style="font-size: 15pt; text-transform: uppercase; margin-top: 15px;">${title}</h2>
      </div>
    `;
  }
}
