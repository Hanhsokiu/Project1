/** Parse quoted CSV (including escaped quotes and newlines) without losing codes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  const first = source.split(/\r?\n/, 1)[0];
  const separator = first.includes(";") && !first.includes(",") ? ";" : ",";
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === separator && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (quoted) throw new Error("Tệp CSV có dấu ngoặc kép chưa đóng.");
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function tableRecords(
  table: string[][],
  kind: "student" | "lecturer",
): Record<string, string>[] {
  if (table.length < 2)
    throw new Error("Tệp cần có dòng tiêu đề và ít nhất một dòng dữ liệu.");
  const headers = table[0].map((x) => x.trim().replace(/^\uFEFF/, ""));
  const required =
    kind === "student"
      ? ["code", "name", "email", "phone", "className", "program", "gpa"]
      : ["code", "name", "email", "phone", "quota"];
  const missing = required.filter((k) => !headers.includes(k));
  if (missing.length)
    throw new Error(
      `Thiếu cột bắt buộc: ${missing.join(", ")}. Hãy tải mẫu tương ứng.`,
    );
  if (new Set(headers).size !== headers.length)
    throw new Error("Tên cột trong tiêu đề bị trùng.");
  return table
    .slice(1)
    .filter((row) => row.some(Boolean))
    .map((row) =>
      Object.fromEntries(headers.map((key, i) => [key, row[i]?.trim() || ""])),
    );
}
export async function readImportFile(file: File, kind: "student" | "lecturer") {
  if (file.size > 4 * 1024 * 1024)
    throw new Error("Tệp import demo tối đa 4 MB.");
  let table: string[][];
  if (file.name.toLowerCase().endsWith(".csv"))
    table = parseCsv(await file.text());
  else if (file.name.toLowerCase().endsWith(".xlsx")) {
    const ExcelJS = await import("exceljs");
    const Workbook = ExcelJS.Workbook || ExcelJS.default.Workbook;
    const book = new Workbook();
    await book.xlsx.load(await file.arrayBuffer());
    const sheet = book.worksheets[0];
    if (!sheet) throw new Error("Workbook không có sheet dữ liệu.");
    table = [];
    sheet.eachRow((row) => {
      const values: string[] = [];
      for (let i = 1; i <= sheet.columnCount; i++) {
        const cell = row.getCell(i);
        values.push(cell.text || "");
      }
      table.push(values);
    });
  } else throw new Error("Chỉ nhận tệp CSV UTF-8 hoặc Excel .xlsx.");
  return tableRecords(table, kind);
}
export function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv =
    "\uFEFF" +
    [
      keys.map(escape).join(","),
      ...rows.map((row) => keys.map((k) => escape(row[k])).join(",")),
    ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
