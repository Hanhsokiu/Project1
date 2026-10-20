/**
 * Tiện ích xử lý và sắp xếp tên tiếng Việt theo chuẩn:
 * Sắp xếp theo Tên trước, nếu Tên trùng nhau thì sắp xếp theo Họ và Tên đệm.
 */

export interface PersonWithName {
  fullName: string;
  [key: string]: any;
}

export class VietnameseNameUtil {
  /**
   * Tách họ và tên đệm, tên chính
   * Ví dụ: "Nguyễn Thị Phương Anh" -> { firstName: "Anh", lastName: "Nguyễn Thị Phương" }
   */
  static splitFullName(fullName: string): { firstName: string; lastName: string } {
    const trimmed = (fullName || '').trim();
    if (!trimmed) return { firstName: '', lastName: '' };

    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }

    const firstName = parts[parts.length - 1];
    const lastName = parts.slice(0, parts.length - 1).join(' ');
    return { firstName, lastName };
  }

  /**
   * Sắp xếp danh sách theo bảng chữ cái tiếng Việt: [Tên + Họ đệm]
   */
  static sortVietnameseNames<T extends PersonWithName>(list: T[]): T[] {
    return [...list].sort((a, b) => {
      const nameA = this.splitFullName(a.fullName);
      const nameB = this.splitFullName(b.fullName);

      // 1. So sánh tên chính (localeCompare tiếng Việt)
      const firstNameCompare = nameA.firstName.localeCompare(nameB.firstName, 'vi', { sensitivity: 'base' });
      if (firstNameCompare !== 0) {
        return firstNameCompare;
      }

      // 2. Nếu tên trùng nhau, so sánh họ và tên đệm
      return nameA.lastName.localeCompare(nameB.lastName, 'vi', { sensitivity: 'base' });
    });
  }
}
