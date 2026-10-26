import {
  AUTH_API,
  getApiUser,
  getAccessToken,
  setApiUser,
} from "../api/api-session";
import { httpClient } from "../api/http-client";
import { hydrateStep1Snapshot, mergeStep1Snapshot } from "./snapshot-api";
import { createSeed, DEMO_VERSION } from "./seed";
import type { Account, DemoDb, Role } from "./types";
export const DATA_KEY = "utc-thesis-demo-v1";
export const SESSION_KEY = "utc-thesis-session";
let memory: DemoDb | undefined;
export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
export function readDb(): DemoDb {
  if (!memory) {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      memory = saved?.version === DEMO_VERSION ? saved : createSeed();
    } catch {
      memory = createSeed();
    }
  }
  const db = mergeStep1Snapshot(structuredClone(memory!));
  const actual = AUTH_API ? getApiUser() : undefined;
  if (actual) {
    db.accounts = db.accounts.filter((a) => a.id !== actual.id).concat(actual);
    if (actual.student && !db.students.some((s) => s.id === actual.studentId))
      db.students.push({
        ...actual.student,
        departmentId: actual.student.departmentId || "",
      });
    if (
      actual.lecturer &&
      !db.lecturers.some((l) => l.id === actual.lecturerId)
    )
      db.lecturers.push(actual.lecturer);
  }
  return db;
}
export function persist(db: DemoDb) {
  const stored = structuredClone(db);
  if (import.meta.env.VITE_REGISTRATION_API === "true") {
    stored.registrations = [];
    stored.assignments = [];
    stored.topics = [];
    stored.notifications = [];
  }
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(stored));
  } catch {
    throw new ServiceError(
      "STORAGE_FULL",
      "Bộ nhớ demo đã đầy. Hãy sử dụng tệp nhỏ hơn hoặc đặt lại dữ liệu demo.",
    );
  }
  memory = stored;
}
export function currentUser(db = readDb()): Account | undefined {
  if (AUTH_API) return getApiUser();
  try {
    const id = sessionStorage.getItem(SESSION_KEY);
    return db.accounts.find((a) => a.id === id && !a.locked);
  } catch {
    return undefined;
  }
}
export function requireUser(db: DemoDb, roles?: Role[]) {
  const user = currentUser(db);
  if (!user) throw new ServiceError("UNAUTHENTICATED", "Vui lòng đăng nhập.");
  if (roles && !roles.some((r) => user.roles.includes(r)))
    throw new ServiceError(
      "FORBIDDEN",
      "Bạn không có quyền thực hiện thao tác này.",
    );
  if (user.mustChangePassword)
    throw new ServiceError(
      "PASSWORD_CHANGE_REQUIRED",
      "Vui lòng đổi mật khẩu lần đầu.",
    );
  return user;
}
export const uid = (prefix = "id") => `${prefix}-${crypto.randomUUID()}`;
export const now = () => new Date().toISOString();
export function mutate<T>(
  action: string,
  roles: Role[] | undefined,
  operation: (db: DemoDb, user: Account) => T,
): T {
  const db = readDb();
  const user = requireUser(db, roles);
  const value = operation(db, user);
  db.audits.unshift({
    id: uid("log"),
    at: now(),
    actor: user.name,
    action,
    detail:
      typeof value === "string"
        ? value
        : "Thao tác trong môi trường dữ liệu demo",
  });
  persist(db);
  return value;
}
export const delay = () => new Promise((resolve) => setTimeout(resolve, 120));
export async function snapshot() {
  await delay();
  if (sessionStorage.getItem("utc-demo-error") === "1") {
    sessionStorage.removeItem("utc-demo-error");
    throw new ServiceError(
      "DEMO_UNAVAILABLE",
      "Không thể tải dữ liệu demo. Vui lòng thử lại.",
    );
  }
  if (AUTH_API && getAccessToken()) {
    try {
      const response = await httpClient.get("/auth/me");
      setApiUser(response.data.data);
    } catch (error) {
      if (!getAccessToken()) return readDb();
      throw error;
    }
  }
  const db = readDb();
  if (AUTH_API && getApiUser()?.mustChangePassword) return db;
  return hydrateStep1Snapshot(db);
}
export function resetDemo() {
  const db = createSeed();
  persist(db);
  sessionStorage.removeItem(SESSION_KEY);
  return db;
}
export function getWorkspaceSelection(): {
  termId?: string;
  studentId?: string;
} {
  try {
    return JSON.parse(sessionStorage.getItem("utc-workspace") || "{}");
  } catch {
    return {};
  }
}
export function setWorkspaceSelection(value: {
  termId?: string;
  studentId?: string;
}) {
  sessionStorage.setItem(
    "utc-workspace",
    JSON.stringify({ ...getWorkspaceSelection(), ...value }),
  );
}
export function assert(
  condition: unknown,
  message: string,
  code = "VALIDATION_ERROR",
): asserts condition {
  if (!condition) throw new ServiceError(code, message);
}
