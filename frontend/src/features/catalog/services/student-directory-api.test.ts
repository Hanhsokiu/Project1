import { beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../shared/api/http-client", () => ({ httpClient: { get: fixture.get } }));
import { loadStudentDirectoryPage, studentDirectoryState } from "./student-directory-api";
const item = (id = "001") => ({
  id, studentCode: id, fullName: "Sinh viên", className: "CNTT", majorName: "Công nghệ thông tin",
  trainingSystemId: "program", trainingSystem: { id: "program", name: "Chính quy" },
  gpa: null, academicEligible: true,
});
beforeEach(() => fixture.get.mockReset());
describe("student directory batches", () => {
  it("requests a bounded API page with cancellation and preserves missing GPA and leading zeroes", async () => {
    fixture.get.mockResolvedValue({ data: { data: { items: [item()], total: 1 } } });
    const signal = new AbortController().signal;
    const page = await loadStudentDirectoryPage(1, signal);
    expect(fixture.get).toHaveBeenCalledWith("/students", { params: { page: 1, pageSize: 100 }, signal });
    expect(page.items[0]).toMatchObject({ code: "001", gpa: null, program: "Chính quy", eligible: true });
    expect(studentDirectoryState([page]).complete).toBe(true);
  });
  it("does not call partial data complete or turn an API failure into empty success", async () => {
    fixture.get.mockResolvedValue({ data: { data: { items: [item()], total: 150 } } });
    const page = await loadStudentDirectoryPage(1);
    expect(studentDirectoryState([page])).toMatchObject({ total: 150, complete: false, error: null });
    fixture.get.mockRejectedValue(new Error("offline"));
    await expect(loadStudentDirectoryPage(2)).rejects.toThrow("offline");
    fixture.get.mockResolvedValue({ data: { data: { items: [], total: 150 } } });
    await expect(loadStudentDirectoryPage(2)).rejects.toThrow("chưa đầy đủ");
  });
  it("requires a consistent complete collection before publishing statistics", async () => {
    fixture.get.mockResolvedValue({ data: { data: { items: [item()], total: 1 } } });
    const page = await loadStudentDirectoryPage(1);
    expect(studentDirectoryState([page, { ...page, page: 2 }])).toMatchObject({ total: null, complete: false, error: expect.any(Error) });
    expect(studentDirectoryState([{ ...page, total: 2 }]).error).toBeInstanceOf(Error);
    expect(studentDirectoryState([page, { ...page, page: 2, total: 2 }]).complete).toBe(false);
  });
});
