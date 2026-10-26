import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSeed } from "./seed";

const fixture = vi.hoisted(() => ({
  token: "token-a",
  role: "FACULTY",
  gpa: 3.2 as number | null,
  request: vi.fn(),
}));
vi.mock("../api/http-client", () => ({
  httpClient: { request: fixture.request },
}));
vi.mock("../api/api-session", () => ({
  getAccessToken: () => fixture.token,
  getApiUser: () => ({
    id: "actual-user",
    name: "Giáo vụ",
    roles: [fixture.role],
    password: "",
    student:
      fixture.role === "STUDENT"
        ? {
            id: "actual-student",
            code: "001",
            name: "Sinh viên thật",
            className: "CNTT",
            program: "Chính quy",
            gpa: fixture.gpa,
            eligible: true,
            email: "",
            phone: "",
          }
        : undefined,
  }),
}));

function respond() {
  const term = {
    ...createSeed().terms[0],
    id: "actual-term",
    studentIds: ["actual-student"],
    lecturers: [{ lecturerId: "actual-lecturer", quota: 2 }],
    assignmentPublished: false,
  };
  const records: Record<string, unknown> = {
    "/terms": { items: [term], total: 1 },
    "/semesters": [
      {
        id: "actual-semester",
        academicYear: "2026-2027",
        semester: 1,
        name: "Học kỳ thật",
        startDate: "2026-09-01",
        endDate: "2027-01-30",
      },
    ],
    "/training-systems": [
      { id: "actual-program", code: "CQ", name: "Chính quy" },
    ],
    "/departments": [
      { id: "actual-department", code: "CNTT", name: "Công nghệ thông tin" },
    ],
    "/research-areas": [{ id: "actual-direction", name: "Phần mềm" }],
    "/students": {
      items: [
        {
          id: "actual-student",
          studentCode: "001",
          fullName: "Sinh viên thật",
          className: "CNTT",
          trainingSystemId: "actual-program",
          gpa: fixture.gpa,
          academicEligible: true,
        },
      ],
      total: 1,
    },
    "/lecturers": {
      items: [
        {
          id: "actual-lecturer",
          lecturerCode: "GV001",
          fullName: "Giảng viên thật",
          departmentId: "actual-department",
          maxStudents: 2,
          researchAreas: [{ id: "actual-direction", name: "Phần mềm" }],
        },
      ],
      total: 1,
    },
  };
  fixture.request.mockImplementation(async ({ url }: { url: string }) => ({
    data: { data: records[url.split("?")[0]] },
  }));
}
beforeEach(() => {
  vi.resetModules();
  fixture.token = "token-a";
  fixture.role = "FACULTY";
  fixture.gpa = 3.2;
  fixture.request.mockReset();
  vi.stubEnv("VITE_TERM_API", "true");
  vi.stubEnv("VITE_CATALOG_API", "true");
  vi.stubEnv("VITE_IMPORT_API", "true");
  respond();
});
afterEach(() => vi.unstubAllEnvs());

describe("per-module API snapshot ownership", () => {
  it("replaces only API-owned lists while preserving mock registration, assignment and topic records", async () => {
    const { hydrateStep1Snapshot, mergeStep1Snapshot } =
      await import("./snapshot-api");
    const mock = createSeed();
    const value = await hydrateStep1Snapshot(mock);
    expect(value.terms.map((t) => t.id)).toEqual(["actual-term"]);
    expect(value.students.map((s) => s.id)).toEqual(["actual-student"]);
    expect(value.lecturers.map((l) => l.id)).toEqual(["actual-lecturer"]);
    expect(value.registrations).toEqual(mock.registrations);
    expect(value.assignments).toEqual(mock.assignments);
    expect(value.topics).toEqual(mock.topics);
    expect(mergeStep1Snapshot(mock).terms[0].id).toBe("actual-term");
    expect(value.students[0].code).toBe("001");
  });
  it("keeps API publication authoritative even when local assignments claim publication", async () => {
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    const mock = createSeed();
    mock.assignments.push({
      ...mock.assignments[0],
      id: "local-assignment",
      termId: "actual-term",
      published: true,
    });
    mock.terms.push({
      ...mock.terms[0],
      id: "actual-term",
      status: "IN_PROGRESS",
    });
    const value = await hydrateStep1Snapshot(mock);
    expect(value.terms[0].assignmentPublished).toBe(false);
    expect(value.terms[0].status).toBe(createSeed().terms[0].status);
  });
  it("does not reuse a previous account token’s snapshot", async () => {
    const { hydrateStep1Snapshot, mergeStep1Snapshot } =
      await import("./snapshot-api");
    const mock = createSeed();
    await hydrateStep1Snapshot(mock);
    fixture.token = "token-b";
    expect(mergeStep1Snapshot(mock).terms[0].id).toBe(mock.terms[0].id);
  });
  it("does not request the restricted student list for a student and bridges the current student profile", async () => {
    fixture.role = "STUDENT";
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    const value = await hydrateStep1Snapshot(createSeed());
    expect(
      fixture.request.mock.calls.some(([request]) =>
        request.url.startsWith("/students"),
      ),
    ).toBe(false);
    expect(value.students.find((s) => s.id === "actual-student")?.code).toBe(
      "001",
    );
    expect(value.accounts.some((a) => a.id === "actual-user")).toBe(true);
  });
  it("surfaces API failures instead of falling back to mock success", async () => {
    fixture.request.mockRejectedValue(new Error("Không kết nối được API"));
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    await expect(hydrateStep1Snapshot(createSeed())).rejects.toThrow(
      "Không kết nối được API",
    );
  });
  it("preserves missing GPA from the API list and the current student's profile without making it eligible", async () => {
    fixture.gpa = null;
    respond();
    const { hydrateStep1Snapshot, mergeStep1Snapshot } =
      await import("./snapshot-api");
    const { formatGpa, hasEligibleGpa } = await import("../utils/gpa");
    const mock = createSeed();
    const managerView = await hydrateStep1Snapshot(mock);
    expect(managerView.students[0].gpa).toBeNull();
    expect(mergeStep1Snapshot(mock).students[0].gpa).toBeNull();
    expect(formatGpa(managerView.students[0].gpa)).toBe("—");
    expect(hasEligibleGpa(managerView.students[0].gpa, 0)).toBe(false);
    fixture.role = "STUDENT";
    const studentView = await hydrateStep1Snapshot(mock);
    expect(
      studentView.students.find((s) => s.id === "actual-student")?.gpa,
    ).toBeNull();
    expect(
      studentView.accounts.find((a) => a.id === "actual-user")?.student?.gpa,
    ).toBeNull();
  });
});
