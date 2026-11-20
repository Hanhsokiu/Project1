import { apiData } from "../api/api-data";
import { vietnamDateTime as phaseTime } from "../utils/vietnam-time";
export { apiData } from "../api/api-data";
import { AUTH_API, getAccessToken, getApiUser } from "../api/api-session";
import { snapshotLookupCache } from "./snapshot-lookup-cache";
import { snapshotPlans, type SnapshotScope } from "./snapshot-scope";
import { selectedTerm } from "./term-selection";
export type { SnapshotScope } from "./snapshot-scope";
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
  term: AUTH_API || import.meta.env.VITE_TERM_API === "true",
  catalog: AUTH_API || import.meta.env.VITE_CATALOG_API === "true",
  imports: AUTH_API || import.meta.env.VITE_IMPORT_API === "true",
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
export interface StudentDto {
  majorName?: string;
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
  academicDegree?: Lecturer["academicDegree"];
  academicRank?: Lecturer["academicRank"];
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
  audits?: DemoDb["audits"];
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
let actionResources: Step1Resources | undefined;

export function studentItem(
  s: StudentDto,
  programs: LookupDto[] = [],
): Student {
  return {
    id: s.id,
    code: s.studentCode,
    name: s.fullName,
    email: s.email || "",
    phone: s.phone || "",
    className: s.className,
    trainingSystemId: s.trainingSystemId,
    majorName: s.majorName || "",
    program:
      s.trainingSystem?.name ||
      programs.find((p) => p.id === s.trainingSystemId)?.name ||
      "",
    departmentId: "",
    gpa: s.gpa === null ? null : Number(s.gpa),
    eligible: s.academicEligible,
  };
}

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
  return actionResources?.token === getAccessToken()
    ? actionResources
    : undefined;
}
/** Synchronous services need the API records already read by scoped screens,
 * e.g. a proposal's expected version and the lecturer import's existing codes.
 * This is not a render snapshot and never makes a partial list look complete.
 */
export function mergeActionSnapshot(mock: DemoDb): DemoDb {
  const current = getStep1Resources();
  return current ? overlay(mock, current) : mergeStep1Snapshot(mock);
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
  if (api.audits) result.audits = api.audits;
  if (REGISTRATION_API)
    result.registrations = structuredClone(api.registrations ?? []);
  if (STEP3_API) {
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
  if (step1Api.catalog && !api.lecturers && user?.lecturer)
    result.lecturers = [user.lecturer];
  if (STEP3_API && api.assignedStudents) {
    for (const s of api.assignedStudents)
      if (!result.students.some((v) => v.id === s.id))
        result.students.push(structuredClone(s));
  }
  return result;
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
/** Server data is authoritative. The API snapshot contains no browser demo artifacts. */
export async function hydrateStep1Snapshot(
  mock: DemoDb,
  scope: SnapshotScope = "full",
  termId?: string,
  savedTermId?: string,
): Promise<DemoDb> {
  const token = getAccessToken();
  if (!token) return mock;
  if (REGISTRATION_API && (!step1Api.term || !step1Api.catalog))
    throw new Error(
      "Đăng ký API yêu cầu bật VITE_TERM_API và VITE_CATALOG_API để dùng đúng danh mục/đợt từ máy chủ.",
    );
  if (!step1Api.term && !step1Api.catalog) return mock;
  const actorRoles = getApiUser()?.roles ?? [];
  // The administrative dashboard displays account/audit totals, while the
  // academic roles display registrations and guidance. Multi-role accounts
  // retain the union needed by the existing dashboard role switcher.
  const academicDashboard = actorRoles.some((role) =>
    ["FACULTY", "LECTURER", "STUDENT"].includes(role),
  );
  const plan =
    scope === "dashboard" && !academicDashboard
      ? {
          ...snapshotPlans[scope],
          students: false,
          lecturers: false,
          directions: false,
          registrations: false,
          assignments: false,
          topics: false,
          outbox: false,
        }
      : snapshotPlans[scope];
  const manager = getApiUser()?.roles.some(
    (role) => role === "ADMIN" || role === "FACULTY",
  );
  const isAdmin = getApiUser()?.roles.includes("ADMIN");
  const lookup = <T>(path: string) =>
    snapshotLookupCache.read(token, path, () => apiData<T>("GET", path));
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
    step1Api.term && plan.lookups
      ? lookup<SemesterDto[]>("/semesters")
      : Promise.resolve([]),
    plan.lookups || plan.students || plan.lecturers
      ? lookup<LookupDto[]>("/training-systems")
      : Promise.resolve([]),
    step1Api.catalog && (plan.lookups || plan.lecturers)
      ? lookup<LookupDto[]>("/departments")
      : Promise.resolve([]),
    step1Api.catalog && plan.directions
      ? lookup<LookupDto[]>("/research-areas")
      : Promise.resolve([]),
    step1Api.catalog && manager && plan.students
      ? apiAll<StudentDto>("/students")
      : Promise.resolve(undefined),
    step1Api.catalog && plan.lecturers
      ? apiAll<LecturerDto>("/lecturers")
      : Promise.resolve(undefined),
    isAdmin && plan.accounts
      ? apiAll<Account>("/accounts")
      : Promise.resolve(undefined),
  ]);
  const actor = getApiUser();
  const visibleTerms = actor?.studentId
    ? (terms ?? []).filter((term) => term.studentIds.includes(actor.studentId!))
    : (terms ?? []);
  const activeTerm = selectedTerm(visibleTerms, termId, savedTermId);
  const contextTerms = plan.termScoped
    ? activeTerm
      ? [activeTerm]
      : []
    : (terms ?? []);
  const value: Step1Resources = {
    token,
    terms,
    semesters,
    programs,
    departments,
    directions,
    accounts,
    students: students?.map((s) => studentItem(s, programs)),
    lecturers: lecturers?.map((l) => ({
      isActive: l.isActive,
      id: l.id,
      code: l.lecturerCode,
      name: l.fullName,
      email: l.email || "",
      phone: l.phone || "",
      departmentId: l.departmentId,
      quota: l.maxStudents,
      academicDegree: l.academicDegree,
      academicRank: l.academicRank,
      directionIds: l.researchAreas.map((a) => a.id),
    })),
  };
  const registrationTask = async () => {
    if (REGISTRATION_API && plan.registrations) {
      if (manager)
        value.registrations = plan.termScoped
          ? activeTerm
            ? (await registrationApi.list(activeTerm.id)).items.map(
                registrationFromApi,
              )
            : []
          : (await registrationApi.list()).items.map(registrationFromApi);
      else if (getApiUser()?.studentId && getApiUser()?.profileComplete) {
        const contexts = await Promise.all(
          contextTerms
            .filter((t) => t.studentIds.includes(getApiUser()!.studentId!))
            .map((t) => registrationApi.current(t.id)),
        );
        value.registrations = contexts.flatMap((c) =>
          c.registration ? [registrationFromApi(c.registration)] : [],
        );
      } else value.registrations = [];
    }
  };
  const workflowTask = async () => {
    if (STEP3_API) {
      value.assignments = [];
      value.topics = [];
      value.notifications = [];
      value.assignedStudents = [];
      const actor = getApiUser();
      if (manager || actor?.studentId || actor?.lecturerId) {
        const contextsTask = Promise.all(
          (plan.assignments || plan.topics || plan.outbox
            ? contextTerms
            : []
          ).map(async (t) => {
            if (!manager && !t.assignmentPublished) return null;
            const [c, topics, events] = await Promise.all([
              plan.assignments
                ? assignmentApi.load(t.id, !!manager)
                : Promise.resolve(null),
              plan.topics && t.assignmentPublished
                ? topicApi.list(t.id)
                : Promise.resolve([]),
              manager && plan.outbox
                ? apiData<
                    {
                      id: string;
                      userId: string;
                      subject: string;
                      status: DemoDb["notifications"][number]["status"];
                      attempts: number;
                      lastError: string | null;
                    }[]
                  >("GET", `/notifications/outbox/term/${t.id}`)
                : Promise.resolve([]),
            ]);
            if (c) cacheAssignment(t.id, c);
            return { c, topics, events, termId: t.id };
          }),
        );
        const ownTask = apiData<
          {
            id: string;
            userId: string;
            termId: string | null;
            title: string;
            body: string;
            status: "READ" | "UNREAD";
            link?: string | null;
          }[]
        >("GET", "/notifications/me");
        const [contexts, own] = await Promise.all([contextsTask, ownTask]);
        for (const v of contexts) {
          if (!v) continue;
          value.assignments.push(...(v.c?.assignments ?? []));
          value.assignedStudents.push(
            ...(v.c?.assignments.map((a) => a.student) ?? []),
          );
          value.topics.push(...v.topics);
          value.notifications.push(
            ...v.events.map((n) => ({
              id: n.id,
              userId: n.userId,
              termId: v.termId,
              title: n.subject,
              content:
                n.lastError ?? `SMTP: ${n.status} · ${n.attempts} lần thử`,
              status: n.status,
              read: false,
              attempts: n.attempts,
              lastError: n.lastError,
              channel: "EMAIL" as const,
            })),
          );
        }
        value.notifications.push(
          ...own.map((n) => ({
            id: n.id,
            userId: n.userId,
            termId: n.termId ?? "",
            title: n.title,
            content: n.body,
            link: n.link,
            status: n.status,
            read: n.status === "READ",
            channel: "IN_APP" as const,
          })),
        );
      }
    }
  };
  const auditTask = async () => {
    if (plan.audits && getApiUser()?.permissions?.includes("audit:read"))
      value.audits = await apiAll<DemoDb["audits"][number]>("/audit-logs");
  };
  await Promise.all([registrationTask(), workflowTask(), auditTask()]);
  if (getAccessToken() !== token)
    throw new Error("Phiên đăng nhập đã thay đổi. Vui lòng tải lại dữ liệu.");
  const next: Step1Resources =
    actionResources?.token === token
      ? { ...actionResources, terms }
      : {
          token,
          terms,
          semesters: [],
          programs: [],
          departments: [],
          directions: [],
        };
  if (plan.lookups) next.semesters = value.semesters;
  if (plan.lookups || plan.students || plan.lecturers)
    next.programs = value.programs;
  if (plan.lookups || plan.lecturers) next.departments = value.departments;
  if (plan.directions) next.directions = value.directions;
  if (value.students) next.students = value.students;
  if (value.lecturers) next.lecturers = value.lecturers;
  if (value.accounts) next.accounts = value.accounts;
  if (value.audits) next.audits = value.audits;
  const termIds = new Set(contextTerms.map((term) => term.id));
  function replaceTerms<T extends { termId: string }>(
    previous: T[] = [],
    incoming: T[] = [],
  ) {
    return plan.termScoped
      ? previous.filter((row) => !termIds.has(row.termId)).concat(incoming)
      : incoming;
  }
  if (plan.registrations)
    next.registrations = replaceTerms(next.registrations, value.registrations);
  if (plan.assignments) {
    next.assignments = replaceTerms(next.assignments, value.assignments);
    next.assignedStudents = [
      ...new Map(
        [
          ...(next.assignedStudents ?? []),
          ...(value.assignedStudents ?? []),
        ].map((student) => [student.id, student]),
      ).values(),
    ];
  }
  if (plan.topics) next.topics = replaceTerms(next.topics, value.topics);
  if (value.notifications)
    next.notifications = (next.notifications ?? [])
      .filter(
        (notice) =>
          notice.channel === "EMAIL" &&
          (!plan.outbox || (plan.termScoped && !termIds.has(notice.termId))),
      )
      .concat(value.notifications);
  actionResources = next;
  // A partial shell must never replace the full snapshot used by synchronous
  // consumers on other screens. Each query owns its own scoped result.
  if (scope === "full") resources = value;
  return overlay(mock, value);
}
