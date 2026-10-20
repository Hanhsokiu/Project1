import { format, parseISO, isValid } from 'date-fns';

export class DateTimeUtil {
  static formatVN(date: Date | string): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return isValid(d) ? format(d, 'dd/MM/yyyy HH:mm') : '';
  }

  static toDate(dateStr: string): Date {
    return parseISO(dateStr);
  }

  static isExpired(date: Date): boolean {
    return date < new Date();
  }
}
