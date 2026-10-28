import { beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "./auth-service";
import { readDb, resetDemo, SESSION_KEY } from "../../../shared/data/store";
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
  sessionStorage.setItem(SESSION_KEY, "admin");
});
describe("student account training program", () => {
  const input = {
    username: "sv-program-test",
    name: "Sinh viên thử hệ",
    email: "program@example.test",
    phone: "0912345678",
    roles: ["STUDENT" as const],
  };
  it("requires a training program before saving an account", () => {
    expect(() => authService.saveAccount(input)).toThrow("hệ đào tạo");
    expect(readDb().accounts.some((a) => a.username === input.username)).toBe(
      false,
    );
  });
  it("creates and updates one student profile with the selected program", () => {
    const programs = readDb().catalogs.filter(
      (c) => c.kind === "program" && c.active,
    );
    authService.saveAccount({ ...input, trainingSystemId: programs[0].id });
    let db = readDb();
    const account = db.accounts.find((a) => a.username === input.username)!;
    expect(db.students.find((s) => s.id === account.studentId)?.program).toBe(
      programs[0].name,
    );
    authService.saveAccount({
      ...input,
      id: account.id,
      trainingSystemId: programs[1].id,
    });
    db = readDb();
    expect(db.students.filter((s) => s.id === account.studentId)).toHaveLength(
      1,
    );
    expect(db.students.find((s) => s.id === account.studentId)?.program).toBe(
      programs[1].name,
    );
  });
});
