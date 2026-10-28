import { apiData } from "../api/api-data";
export { apiData } from "../api/api-data";
import { getAccessToken, getApiUser } from "../api/api-session";
import {
  assignmentApi,
  cacheAssignment,
  STEP3_API,
} from "../../features/registration/services/assignment-api";
import { topicApi } from "../../features/topic/services/topic-api";
import type {
  Account,
  CatalogItem,
  DemoDb,
  Lecturer,
  Student,
  Term,
  Registration,
} from "./types";
import {
  registrationApi,
  registrationFromApi,
  REGISTRATION_API,
} from "../../features/registration/services/registration-api";

export const step1Api = {
  term: import.meta.env.VITE_TERM_API === "true",
  catalog: import.meta.env.VITE_CATALOG_API === "true",
  imports: import.meta.env.VITE_IMPORT_API === "true",
};
export interface SemesterDto {
  id: string;
  academicYear: string;
  semester: number;
  name: string;
  startDate: string;
  endDate: string;
}
export interface LookupDto {
  id: string;
  code?: string;
  name: string;
  isActive?: boolean;
  active?: boolean;
  description?: string;
}
interface StudentDto {
  id: string;
  studentCode: string;
  fullName: string;
  className: string;
  cohort?: string;
  gpa: number | null;
  academicEligible: boolean;
  trainingSystemId: string;
  trainingSystem?: LookupDto;
  email?: string | null;
  phone?: string | null;
}
interface LecturerDto {
  isActive: boolean;
  id: string;
  lecturerCode: string;
  fullName: string;
  departmentId: string;
  email?: string | null;
  phone?: string | null;
  maxStudents: number;
  researchAreas: LookupDto[];
}
interface ApiPage<T> {
  items?: T[];
  data?: T[];
  total: number;
  page?: number;
  pageSize?: number;
  limit?: number;
  totalPages?: number;
}
interface Step1Resources {
  academicAccessWarnings?: string[];
  assignments?: DemoDb["assignments"];
  topics?: DemoDb["topics"];
  notifications?: DemoDb["notifications"];
  assignedStudents?: DemoDb["students"];
  registrations?: Registration[];
  token: string;
  terms?: Term[];
  students?: Student[];
  lecturers?: Lecturer[];
  accounts?: Account[];
  semesters: SemesterDto[];
  programs: LookupDto[];
  departments: LookupDto[];
  directions: LookupDto[];
}
let resources: Step1Resources | undefined;

export async function apiAll<T>(url: string): Promise<T[]> {
  const rows: T[] = [];
  let page = 1;
  for (;;) {
    const response = await apiData<ApiPage<T> | T[]>(
      "GET",
      `${url}${url.includes("?") ? "&" : "?"}page=${page}&pageSize=100&limit=100`,
    );
    if (Array.isArray(response)) return response;
    const items = response.items ?? response.data ?? [];
    rows.push(...items);
    if (
      !items.length ||
      rows.length >= response.total ||
      (response.totalPages && page >= response.totalPages)
    )
      return rows;
    page++;
  }
}
export function getStep1Resources() {
  return resources;
}
export function semesterItem(item: SemesterDto): CatalogItem {
  return {
    id: item.id,
    kind: "semester",
    code: `${item.academicYear}-${item.semester}`,
    name: item.name || `${item.academicYear} / Học kỳ ${item.semester}`,
    active: true,
  };
}
function lookupItem(item: LookupDto, kind: CatalogItem["kind"]): CatalogItem {
  return {
    id: item.id,
    kind,
    code: item.code || `HD-${item.id.slice(0, 8)}`,
    name: item.name,
    active: item.isActive ?? item.active ?? true,
  };
}
function overlay(mock: DemoDb, api: Step1Resources): DemoDb {
  const result = structuredClone(mock);
  if (REGISTRATION_API)
    result.registrations = structuredClone(api.registrations ?? []);
  if (STEP3_API) {
    result.academicAccessWarnings = [...(api.academicAccessWarnings ?? [])];
    result.assignments = structuredClone(api.assignments ?? []);
    result.topics = structuredClone(api.topics ?? []);
    result.notifications = structuredClone(api.notifications ?? []);
  }
  const user = getApiUser() as
    | (Account & {
        student?: Omit<Student, "departmentId">;
        lecturer?: Lecturer;
      })
    | undefined;
  if (api.accounts) {
    result.accounts = structuredClone(api.accounts);
  }
  if (user)
    result.accounts = [
      ...result.accounts.filter((a) => a.id !== user.id),
      { ...user, password: "" },
    ];
  if (step1Api.term && api.terms) {
    result.terms = api.terms.map((term) => ({
      ...structuredClone(term),
      phases: term.phases.map((phase) => ({
        ...phase,
        start: phaseTime(phase.start),
        end: phaseTime(phase.end),
      })),
      assignmentPublished: term.assignmentPublished,
      resultsPublished: term.resultsPublished,
    }));
    result.catalogs = result.catalogs
      .filter((c) => c.kind !== "semester")
      .concat(api.semesters.map(semesterItem));
  }
  if (step1Api.catalog) {
    if (api.students) result.students = structuredClone(api.students);
    if (api.lecturers) result.lecturers = structuredClone(api.lecturers);
    const preserved = result.catalogs.filter((c) => c.kind === "semester");
    result.catalogs = [
      ...preserved,
      ...api.programs.map((p) => lookupItem(p, "program")),
      ...api.departments.map((p) => lookupItem(p, "department")),
      ...api.directions.map((p) => lookupItem(p, "direction")),
    ];
  }
  if (step1Api.catalog && !api.students && user?.student) {
    result.students = [
      ...result.students.filter((s) => s.id !== user.student!.id),
      {
        ...user.student,
        email: user.student.email || "",
        phone: user.student.phone || "",
        departmentId: "",
      },
    ];
  }
  if (STEP3_API && api.assignedStudents) {
    for (const s of api.assignedStudents)
      if (!result.students.some((v) => v.id === s.id))
        result.students.push(structuredClone(s));
  }
  return result;
}
function phaseTime(value: string) {
  return value.length === 10
    ? `${value}T00:00`
    : new Date(value)
        .toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" })
        .replace(" ", "T")
        .slice(0, 16);
}
/** Cached API data remains authoritative for synchronous consumers. */
export function mergeStep1Snapshot(mock: DemoDb): DemoDb {
  if (REGISTRATION_API) mock.registrations = [];
  if (STEP3_API) {
    mock.assignments = [];
    mock.topics = [];
    mock.notifications = [];
    mock.reviewGroups = [];
  }
  return resources && resources.token === getAccessToken()
    ? overlay(mock, resources)
    : mock;
}
/** API-owned lists are authoritative; later-step artifacts remain in the existing mock store. No silent API→mock fallback. */
export async function hydrateStep1Snapshot(mock: DemoDb): Promise<DemoDb> {
  const token = getAccessToken();
  if (!token) return mock;
  if (REGISTRATION_API && (!step1Api.term || !step1Api.catalog))
    throw new Error(
      "Đăng ký API yêu cầu bật VITE_TERM_API và VITE_CATALOG_API để dùng đúng danh mục/đợt từ máy chủ.",
    );
  if (!step1Api.term && !step1Api.catalog) return mock;
  const manager = getApiUser()?.roles.some(
    (role) => role === "ADMIN" || role === "FACULTY",
  );
  const isAdmin = getApiUser()?.roles.includes("ADMIN");
  const [
    terms,
    semesters,
    programs,
    departments,
    directions,
    students,
    lecturers,
    accounts,
  ] = await Promise.all([
    step1Api.term ? apiAll<Term>("/terms") : Promise.resolve(undefined),
    step1Api.term
      ? apiData<SemesterDto[]>("GET", "/semesters")
      : Promise.resolve([]),
    apiData<LookupDto[]>("GET", "/training-systems"),
    step1Api.catalog
      ? apiData<LookupDto[]>("GET", "/departments")
      : Promise.resolve([]),
    step1Api.catalog
      ? apiData<LookupDto[]>("GET", "/research-areas")
      : Promise.resolve([]),
    step1Api.catalog && manager
      ? apiAll<StudentDto>("/students")
      : Promise.resolve(undefined),
    step1Api.catalog
      ? apiAll<LecturerDto>("/lecturers")
      : Promise.resolve(undefined),
    isAdmin ? apiAll<Account>("/accounts") : Promise.resolve(undefined),
  ]);
  const value: Step1Resources = {
    token,
    terms,
    semesters,
    programs,
    departments,
    directions,
    accounts,
    students: students?.map((s) => ({
      id: s.id,
      code: s.studentCode,
      name: s.fullName,
      email: s.email || "",
      phone: s.phone || "",
      className: s.className,
      program:
        s.trainingSystem?.name ||
        programs.find((p) => p.id === s.trainingSystemId)?.name ||
        "",
      departmentId: "",
      gpa: s.gpa === null ? null : Number(s.gpa),
      eligible: s.academicEligible,
    })),
    lecturers: lecturers?.map((l) => ({
      isActive: l.isActive,
      id: l.id,
      code: l.lecturerCode,
      name: l.fullName,
      email: l.email || "",
      phone: l.phone || "",
      departmentId: l.departmentId,
      quota: l.maxStudents,
      directionIds: l.researchAreas.map((a) => a.id),
    })),
  };
  if (REGISTRATION_API) {
    if (manager)
      value.registrations = (await registrationApi.list()).items.map(
        registrationFromApi,
      );
    else if (getApiUser()?.studentId && getApiUser()?.profileComplete) {
      const contexts = await Promise.all(
        (terms ?? [])
          .filter((t) => t.studentIds.includes(getApiUser()!.studentId!))
          .map((t) => registrationApi.current(t.id)),
      );
      value.registrations = contexts.flatMap((c) =>
        c.registration ? [registrationFromApi(c.registration)] : [],
      );
    } else value.registrations = [];
  }
  if (STEP3_API) {
    value.assignments = [];
    value.topics = [];
    value.notifications = [];
    value.assignedStudents = [];
    value.academicAccessWarnings = [];
    const scopedRead = async <T>(
      read: () => Promise<T>,
      unavailable: T,
      term: Term,
      label: string,
    ): Promise<T> => {
      try {
        return await read();
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "status" in error &&
          error.status === 403 &&
          "code" in error &&
          ["TOPIC_SCOPE_FORBIDDEN", "OUTBOX_SCOPE_FORBIDDEN"].includes(
            String(error.code),
          )
        ) {
          value.academicAccessWarnings!.push(
            `Đợt ${term.code}: không có quyền đọc ${label}; phần dữ liệu này chưa được tải.`,
          );
          return unavailable;
        }
        throw error;
      }
    };
    const actor = getApiUser();
    if (manager || actor?.studentId || actor?.lecturerId) {
      const contexts = await Promise.all(
        (terms ?? []).map(async (t) => {
          if (!manager && !t.assignmentPublished) return null;
          const c = await assignmentApi.load(t.id, !!manager);
          cacheAssignment(t.id, c);
          const topics = t.assignmentPublished
            ? await scopedRead(() => topicApi.list(t.id), [], t, "đề tài")
            : [];
          const events = manager
            ? await scopedRead(
                () =>
                  apiData<
                    {
                      id: string;
                      userId: string;
                      subject: string;
                      status: DemoDb["notifications"][number]["status"];
                      attempts: number;
                      lastError: string | null;
                    }[]
                  >("GET", `/notifications/outbox/term/${t.id}`),
                [],
                t,
                "outbox toàn đợt",
              )
            : [];
          return { c, topics, events, termId: t.id };
        }),
      );
      for (const v of contexts) {
        if (!v) continue;
        value.assignments.push(...v.c.assignments);
        value.assignedStudents.push(...v.c.assignments.map((a) => a.student));
        value.topics.push(...v.topics);
        value.notifications.push(
          ...v.events.map((n) => ({
            id: n.id,
            userId: n.userId,
            termId: v.termId,
            title: n.subject,
            content: n.lastError ?? `SMTP: ${n.status} · ${n.attempts} lần thử`,
            status: n.status,
            read: false,
            attempts: n.attempts,
            lastError: n.lastError,
            channel: "EMAIL" as const,
          })),
        );
      }
      const own = await apiData<
        {
          id: string;
          userId: string;
          termId: string | null;
          title: string;
          body: string;
          status: "READ" | "UNREAD";
        }[]
      >("GET", "/notifications/me");
      value.notifications.push(
        ...own.map((n) => ({
          id: n.id,
          userId: n.userId,
          termId: n.termId ?? "",
          title: n.title,
          content: n.body,
          status: n.status,
          read: n.status === "READ",
          channel: "IN_APP" as const,
        })),
      );
    }
  }
  resources = value;
  value.academicAccessWarnings?.sort();
  return overlay(mock, value);
}
