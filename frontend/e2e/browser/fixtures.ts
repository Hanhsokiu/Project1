import { test as base, expect, type Page, type Route } from "@playwright/test";

export const origin: string =
  require("../../scripts/browser-settings.cjs").browserOrigin;
type Handler = (route: Route) => Promise<void>;
export class MockNetwork {
  readonly requests: { method: string; path: string; body: unknown }[] = [];
  readonly unexpected: string[] = [];
  private readonly handlers = new Map<string, Handler>();
  handle(method: string, path: string, handler: Handler) {
    this.handlers.set(`${method} ${path}`, handler);
  }
  mock(method: string, path: string, data: unknown, status = 200) {
    this.handle(method, path, (route) =>
      route.fulfill({ status, json: { data } }),
    );
  }
  error(
    method: string,
    path: string,
    status: number,
    code: string,
    message: string,
  ) {
    this.handle(method, path, (route) =>
      route.fulfill({ status, json: { error: { code, message } } }),
    );
  }
  async dispatch(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      this.unexpected.push(
        `External request blocked: ${url.origin}${url.pathname}`,
      );
      return route.abort("blockedbyclient");
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      let body: unknown = null;
      try {
        body = request.postDataJSON();
      } catch {
        /* Non-JSON body. */
      }
      this.requests.push({
        method: request.method(),
        path: url.pathname,
        body,
      });
      const handler = this.handlers.get(`${request.method()} ${url.pathname}`);
      if (handler) return handler(route);
      this.unexpected.push(
        `Unmocked API blocked: ${request.method()} ${url.pathname}`,
      );
      return route.fulfill({
        status: 501,
        json: {
          error: { code: "E2E_UNMOCKED_API", message: "Missing browser mock" },
        },
      });
    }
    return route.continue(); // Local Vite modules/assets only.
  }
}
export const test = base.extend<{ network: MockNetwork }>({
  network: [
    async ({ context, page }, use) => {
      const network = new MockNetwork();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await context.route("**/*", (route) => network.dispatch(route));
      await context.routeWebSocket("**/*", (socket) => {
        if (new URL(socket.url()).host === new URL(origin).host)
          socket.connectToServer();
        else {
          network.unexpected.push("External WebSocket blocked");
          void socket.close();
        }
      });
      await use(network);
      expect(
        network.unexpected,
        "Tests must explicitly mock every API; never forward to a backend",
      ).toEqual([]);
      expect(errors, "Unhandled browser JavaScript errors").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
export const fakeActor = {
  id: "browser-test-lecturer",
  username: "browser-test",
  name: "Browser Test Lecturer",
  email: "browser-test@example.invalid",
  phone: "",
  password: "",
  roles: ["LECTURER"],
  locked: false,
  mustChangePassword: false,
  profileComplete: true,
};
export async function signInFixture(page: Page, roles = ["LECTURER"]) {
  await page.addInitScript(
    (actor) => {
      if (sessionStorage.getItem("pw-actor-initialized")) return;
      sessionStorage.setItem("pw-actor-initialized", "1");
      sessionStorage.setItem(
        "utc-api-access",
        "browser-test-token-not-a-real-jwt",
      );
      sessionStorage.setItem("utc-api-user", JSON.stringify(actor));
    },
    { ...fakeActor, roles },
  );
}
export function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
export const inboxPath = "/api/terms/browser-term/grading/inbox";
export const detailPath =
  "/api/terms/browser-term/grading/proposals/browser-proposal/REVIEWER";
export const inbox = (items: unknown[] = []) => ({
  termId: "browser-term",
  kind: "REVIEWER",
  items,
  blockers: [],
});
export const assignedRow = {
  proposalId: "browser-proposal",
  studentName: "Browser Student",
  title: "Browser-only thesis",
  state: "DRAFT",
  revision: 1,
};
export function gradeContext(revision = 1) {
  return {
    termId: "browser-term",
    proposalId: "browser-proposal",
    kind: "REVIEWER",
    title: "Browser-only thesis",
    studentName: "Browser Student",
    expectedContext: String(revision).repeat(64),
    expectedRevision: revision,
    policyRevision: 1,
    grade: {
      configured: true,
      state: "DRAFT",
      revision,
      draft: {
        values: { TEST: 8 },
        comment: "Browser-only comment",
        questions: ["Question one?", "Question two?"],
      },
      total: 8,
      at: "2026-10-28T00:00:00Z",
    },
    rubric: [{ code: "TEST", label: "Browser criterion", maxScore: 10 }],
    blockers: [],
    canSave: true,
    canSeal: true,
    window: null,
    pdf: null,
    source: null,
  };
}
