export class DateTimeUtil {
  static formatVN(value: Date | string) {
    const date = typeof value === "string" ? this.toDate(value) : value;
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          dateStyle: "short",
          timeStyle: "short",
        }).format(date)
      : "";
  }
  static toDate(value: string) {
    return new Date(
      /[zZ]|[+-]\d\d:\d\d$/.test(value)
        ? value
        : value.length === 10
          ? value + "T00:00:00+07:00"
          : value + "+07:00",
    );
  }
  static isExpired(date: Date) {
    return date.getTime() < Date.now();
  }
}
