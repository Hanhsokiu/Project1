import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  persist,
  readDb,
  resetDemo,
  SESSION_KEY,
} from "../../../shared/data/store";
import { mockCatalogService as catalogService } from "./catalog-service";
import { parseCsv, readImportFile, tableRecords } from "./import-file";
import { mockTermService as termService } from "../../term/services/term-service";
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
  };
}
beforeEach(() => {
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  resetDemo();
  sessionStorage.setItem(SESSION_KEY, "khoa");
});
const row = (code = "001234567") => ({
  code,
  name: "Nguyễn Văn Mẫu",
  email: "mau@example.com",
  phone: "0912345678",
  className: "CNTT K64",
  program: "Chính quy",
  gpa: "3.20",
});
function newTerm() {
  return termService.save({
    code: "DATN-TEST",
    name: "Đợt kiểm thử nghiệp vụ",
    semester: readDb().catalogs.find((c) => c.kind === "semester")!.name,
    program: "Chính quy",
    start: "2026-10-01",
    end: "2027-02-28",
    registrationStart: "2026-10-01T08:00",
    registrationEnd: "2026-10-30T17:00",
  })!;
}
describe("CSV and import contracts", () => {
  it("preserves leading zero codes, quoted separators and embedded newlines", () => {
    const data = parseCsv(
      '\uFEFFcode,name,email,phone,className,program,gpa\r\n001,"Nguyễn, Văn\nMẫu",mau@example.com,0912345678,CNTT,Chính quy,3.2',
    );
    expect(data[1][0]).toBe("001");
    expect(data[1][1]).toBe("Nguyễn, Văn\nMẫu");
    expect(tableRecords(data, "student")[0].gpa).toBe("3.2");
  });
  it("rejects a wrong header, an unclosed quoted field and unsupported file types", async () => {
    expect(() =>
      tableRecords(
        [
          ["code", "name"],
          ["001", "Mẫu"],
        ],
        "student",
      ),
    ).toThrow("Thiếu cột");
    expect(() => parseCsv('code,name\n001,"unclosed')).toThrow("chưa đóng");
    await expect(
      readImportFile({ name: "fake.xls", size: 10 } as File, "student"),
    ).rejects.toThrow("CSV");
  });
  it("validates each row and detects existing and repeated codes without resetting accounts", () => {
    const valid = catalogService.validateImport([row()], "student", []);
    expect(valid[0].errors).toHaveLength(0);
    const invalid = catalogService.validateImport(
      [row(), { ...row(), gpa: "", phone: "bad" }],
      "student",
      [],
    );
    expect(invalid[1].errors.join(" ")).toMatch(/trùng/);
    expect(invalid[1].errors.join(" ")).toMatch(/GPA/);
    catalogService.importRows(valid, "student");
    const account = readDb().accounts.find((a) => a.username === "001234567")!;
    expect(account.mustChangePassword).toBe(true);
    expect(() => catalogService.importRows(valid, "student")).toThrow(
      "thay đổi",
    );
    expect(
      readDb().accounts.filter((a) => a.username === account.username),
    ).toHaveLength(1);
  });
  it("imports records and roster together, rolling back all rows when a program is mismatched", () => {
    const id = newTerm();
    const start = readDb().students.length;
    const valid = catalogService.validateImport([row()], "student", []);
    catalogService.importRows(valid, "student", id);
    let db = readDb();
    expect(db.students.length).toBe(start + 1);
    expect(db.terms.find((t) => t.id === id)!.studentIds).toContain(
      db.students.find((s) => s.code === "001234567")!.id,
    );
    const next = catalogService.validateImport(
      [row("001234568"), { ...row("001234569"), program: "Liên thông" }],
      "student",
      [],
    );
    expect(() => catalogService.importRows(next, "student", id)).toThrow(
      "khớp đợt",
    );
    db = readDb();
    expect(db.students.some((s) => s.code === "001234568")).toBe(false);
    expect(db.accounts.some((a) => a.username === "001234568")).toBe(false);
  });
});
describe("term readiness and roster rules", () => {
  it("creates useful ordered phases and blocks opening without the roster, then opens valid configuration", () => {
    const id = newTerm();
    const t = readDb().terms.find((t) => t.id === id)!;
    expect(t.status).toBe("DRAFT");
    expect(t.phases).toHaveLength(3);
    expect(t.phases[1].start > t.phases[0].end).toBe(true);
    expect(() => termService.transition(id, "OPEN_REGISTRATION")).toThrow(
      "sinh viên",
    );
    termService.saveRoster(id, ["sv1"], [{ lecturerId: "gv1", quota: 2 }]);
    termService.transition(id, "OPEN_REGISTRATION");
    expect(readDb().terms.find((t) => t.id === id)!.status).toBe(
      "OPEN_REGISTRATION",
    );
  });
  it("rejects mismatched programs, duplicate people, nonexistent lecturers and quotas below assignment load", () => {
    const id = newTerm();
    let db = readDb();
    db.students[0].program = "Liên thông";
    persist(db);
    expect(() => termService.saveRoster(id, ["sv1"], [])).toThrow("khớp");
    db = readDb();
    db.students[0].program = "Chính quy";
    persist(db);
    expect(() => termService.saveRoster(id, ["sv1", "sv1"], [])).toThrow(
      "trùng",
    );
    expect(() =>
      termService.saveRoster(
        id,
        ["sv1"],
        [{ lecturerId: "unknown", quota: 2 }],
      ),
    ).toThrow("không tồn tại");
    expect(() =>
      termService.saveRoster("dot1", readDb().terms[0].studentIds, [
        { lecturerId: "gv1", quota: 0 },
      ]),
    ).toThrow();
  });
  it("blocks overlapping phases and changes to locked or cancelled terms", () => {
    const id = newTerm();
    const t = readDb().terms.find((t) => t.id === id)!;
    const overlap = structuredClone(t.phases);
    overlap[1].start = overlap[0].end;
    expect(() => termService.savePhases(id, overlap)).toThrow("chồng");
    termService.toggleLock(id);
    expect(() => termService.savePhases(id, t.phases)).toThrow("khóa");
    termService.toggleLock(id);
    termService.transition(id, "CANCELLED");
    expect(() => termService.toggleLock(id)).toThrow("hủy");
  });
  it("validates weight sums and prevents reopening registration after publication", () => {
    const id = newTerm();
    const t = readDb().terms.find((t) => t.id === id)!;
    expect(() =>
      termService.saveParameters(id, { ...t.parameters, process_weight: 0.7 }),
    ).toThrow("bằng 1");
    termService.saveParameters(id, {
      ...t.parameters,
      process_weight: 0.3,
      committee_weight: 0.7,
    });
    expect(
      readDb().terms.find((t) => t.id === id)!.parameters.process_weight,
    ).toBe(0.3);
    const db = readDb();
    const target = db.terms.find((t) => t.id === id)!;
    target.status = "CLOSED_REGISTRATION";
    target.assignmentPublished = true;
    persist(db);
    expect(() => termService.transition(id, "OPEN_REGISTRATION")).toThrow(
      "công bố",
    );
  });
});
