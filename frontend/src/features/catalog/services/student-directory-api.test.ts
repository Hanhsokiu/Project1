import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentDirectoryQuerySchema } from "@doan/shared";
const fixture = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../shared/api/http-client", () => ({ httpClient: { get: fixture.get } }));
import { loadStudentDirectoryOptions, loadStudentDirectoryPage } from "./student-directory-api";
const item = { id: "001", studentCode: "001", fullName: "Sinh viên", className: "CNTT", majorName: "CNTT",
  trainingSystemId: "program", trainingSystem: { id: "program", code: "CQ", name: "Chính quy" },
  gpa: null, academicEligible: true, email: null, phone: null };
const page = { items: [item], total: 1, page: 1, pageSize: 8, totalPages: 1 };
beforeEach(() => { fixture.get.mockReset(); });
describe("server student directory", () => {
  it("requests one bounded server page with cancellation and preserves null GPA and leading zeroes", async () => {
    fixture.get.mockResolvedValue({ data: { data: page } });
    const signal = new AbortController().signal;
    const query = StudentDirectoryQuerySchema.parse({ search: "CNTT", sortBy: "gpa" });
    const result = await loadStudentDirectoryPage(query, signal);
    expect(fixture.get).toHaveBeenCalledWith("/students/directory", { params: query, signal });
    expect(result.items[0]).toMatchObject({ code: "001", gpa: null, program: "Chính quy", eligible: true });
  });
  it("rejects truncated/mismatched pages and propagates API errors", async () => {
    const query = StudentDirectoryQuerySchema.parse({});
    for (const invalid of [{ ...page, total: 120, totalPages: 15 }, { ...page, page: 2 }, { ...page, pageSize: 100 }]) {
      fixture.get.mockResolvedValue({ data: { data: invalid } });
      await expect(loadStudentDirectoryPage(query)).rejects.toThrow();
    }
    fixture.get.mockRejectedValue(new Error("offline"));
    await expect(loadStudentDirectoryPage(query)).rejects.toThrow("offline");
  });
  it("loads global options independently and refuses inconsistent statistics", async () => {
    const signal = new AbortController().signal;
    const summary = { total: 120, eligible: 118, ineligible: 2, classes: ["CNTT", "LOP CUOI"] };
    fixture.get.mockResolvedValue({ data: { data: summary } });
    expect(await loadStudentDirectoryOptions(signal)).toEqual(summary);
    expect(fixture.get).toHaveBeenCalledWith("/students/directory-options", { signal });
    fixture.get.mockResolvedValue({ data: { data: { ...summary, eligible: 120 } } });
    await expect(loadStudentDirectoryOptions()).rejects.toThrow();
  });
});
