// TEST_ONLY: real UC17–UC25 services, in-memory persistence/storage; no env/DB.
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import type { ReportCode, ReportPolicy, ReportRequest } from "@doan/shared";
import { createFinalResultFixture } from "./final-result.fixture";
import { ids } from "./final-defense.fixture";
import { memberId } from "./eligibility.fixture";
import { ReportService } from "../src/report/defense-reporting/report.service";
import { ReportReader } from "../src/report/defense-reporting/report.reader";
import { ReportTemplates } from "../src/report/defense-reporting/report-templates";
import { ReportRenderer } from "../src/report/defense-reporting/report-renderer";
import {
  ReportRepository,
  ReportSession,
} from "../src/report/defense-reporting/report.repository";
import { DossierPdfService } from "../src/topic/proposal-dossiers/dossier-pdf.service";
import { DossierValidator } from "../src/topic/proposal-dossiers/dossier.validator";
import { CommitteeGradeValidator } from "../src/defense/committee-grading/committee-grade.validator";
import { ProposalReviewValidator } from "../src/topic/proposal-reviews/proposal-review.validator";
import { GuidanceValidator } from "../src/guidance/tasks/guidance.validator";
export async function createReportingFixture(publish = true) {
  const result = await createFinalResultFixture();
  await result.confirm();
  await result.command("finalize");
  if (publish) await result.command("publish");
  const templates = new ReportTemplates(),
    policy: ReportPolicy = {
      version: "UNIT_MEMORY_FIXTURE_UC25",
      status: "APPROVED",
      approvedBy: ids.faculty,
      approvedAt: "2020-01-01T00:00:00Z",
      reference: "UNIT_MEMORY_FIXTURE; not faculty approval",
      memberResults: "EXPLICIT_RESULT_PERMISSION",
      statisticsRelease: "PUBLISHED_ONLY",
      incompleteDraft: false,
      retentionDays: 30,
      signature: "UNSIGNED_ONLY",
      distribution: [],
      templates: templates.all(null).map((t) => ({
        ...t,
        version: "UNIT_MEMORY_FIXTURE_V1",
        status: "APPROVED",
        approval: {
          by: ids.faculty,
          at: "2020-01-01T00:00:00Z",
          reference: "UNIT_MEMORY_FIXTURE layout",
        },
        institution: { school: "TRƯỜNG KIỂM THỬ", faculty: "KHOA KIỂM THỬ" },
        signatureRoles: t.code === "PDF_MINUTES" ? ["CHAIR", "SECRETARY"] : [],
        allowMissing: [],
        requirePublished: true,
      })),
    };
  const permit = (
    actor: string,
    role: string,
    actions: string[],
    resource = "defense-report",
  ) => {
    for (const action of actions)
      result.users
        .get(actor)!
        .userRoles.find((r) => r.role.name === role)!
        .role.rolePermissions.push({
          permission: { resource, action },
        } as never);
  };
  const actions = [
    "read",
    "statistics",
    "templates-read",
    "preview",
    "export",
    "download",
    "history-read",
    "list-export",
    "components-export",
    "final-export",
    "comments-export",
    "minutes-export",
    "draft-preview",
    "draft-export",
    "grade-statistics",
    "score-statistics",
    "dossier-export",
    "pii-export",
  ];
  permit(ids.faculty, "FACULTY", actions);
  permit(ids.faculty, "FACULTY", ["comment-read"], "defense-reviewer-grade");
  permit(ids.faculty, "FACULTY", ["comment-read"], "defense-confirmation");
  permit(ids.faculty, "FACULTY", ["export"], "dossier");
  for (const member of ["l1", "l2", "l3"])
    permit(result.cg.actor(member), "LECTURER", actions);
  const control = {
    writes: true,
    policy: true,
    renderFailure: false,
    eventFailure: false,
    rememberFailure: false,
    maxRows: 100,
    maxBytes: 10 * 1024 * 1024,
    maxCandidates: 1000,
    rendering: false,
  };
  let state = {
    events: [] as {
      id: string;
      userId: string;
      resourceId: string;
      action: string;
      newValue: unknown;
      createdAt: Date;
    }[],
    keys: new Map<string, { payloadHash: string; result: unknown }>(),
  };
  const session = {
    ...result.session,
    rpPolicy: async () => ({
      value: control.policy ? JSON.stringify(policy) : null,
    }),
    rpCandidates: async (_t: string, className?: string) =>
      className && className !== result.f.p.student.className
        ? []
        : [{ id: memberId }],
    rpEvent: async (
      actor: string,
      id: string,
      action: string,
      value: unknown,
    ) => {
      if (control.eventFailure) throw Error("TEST_ONLY audit failure");
      state.events.push({
        id: randomUUID(),
        userId: actor,
        resourceId: id,
        action,
        newValue: structuredClone(value),
        createdAt: new Date(),
      });
    },
    rpMetadata: async (id: string, actor: string) =>
      state.events.find(
        (e) =>
          e.resourceId === id &&
          e.userId === actor &&
          ["EXPORT_GENERATED", "GENERATION_FAILED"].includes(e.action),
      ) ?? null,
    rpHistory: async (actor: string) =>
      state.events.filter(
        (e) =>
          e.userId === actor &&
          ["EXPORT_GENERATED", "GENERATION_FAILED"].includes(e.action),
      ),
    replay: async (actor: string, route: string, key: string) =>
      state.keys.get([actor, route, key].join("|")) ?? null,
    remember: async (
      actor: string,
      route: string,
      key: string,
      payloadHash: string,
      value: unknown,
    ) => {
      if (control.rememberFailure) throw Error("TEST_ONLY key failure");
      state.keys.set([actor, route, key].join("|"), {
        payloadHash,
        result: structuredClone(value),
      });
    },
  } as unknown as ReportSession;
  let queue = Promise.resolve();
  const repo = {
    read: <T>(fn: (s: ReportSession) => Promise<T>) => fn(session),
    write: <T>(fn: (s: ReportSession) => Promise<T>) => {
      const job = queue.then(async () => {
        const before = structuredClone(state);
        try {
          return await fn(session);
        } catch (e) {
          state = before;
          throw e;
        }
      });
      queue = job.then(
        () => {},
        () => {},
      );
      return job;
    },
  } as ReportRepository;
  const config = {
      get: (key: string, fallback?: unknown) =>
        (
          ({
            UC25_WRITES_ENABLED: control.writes ? "true" : "false",
            UC25_MAX_ROWS: control.maxRows,
            UC25_MAX_BYTES: control.maxBytes,
            UC25_MAX_CANDIDATES: control.maxCandidates,
          }) as Record<string, unknown>
        )[key] ?? fallback,
    } as ConfigService,
    review = new ProposalReviewValidator(),
    reader = new ReportReader(
      result.cg.cc.service,
      result.cg.rw.service,
      result.cg.rg.service,
      result.cg.service,
      new CommitteeGradeValidator(),
      result.service,
      result.advisors,
      result.cg.cc.eligibility.service,
      result.cg.sc.service,
      review,
      new GuidanceValidator(review),
      new DossierValidator(review),
      config,
    ),
    realRenderer = new ReportRenderer(new DossierPdfService()),
    renderer = {
      render: async (...args: Parameters<ReportRenderer["render"]>) => {
        if (control.renderFailure)
          throw Error("TEST_ONLY private details must be redacted");
        if (control.rendering) throw Error("TEST_ONLY busy");
        return realRenderer.render(...args);
      },
    } as ReportRenderer,
    service = new ReportService(repo, reader, templates, renderer, config);
  const request = (
    code: ReportCode = "XLSX_OFFICIAL_RESULTS",
    mode: "OFFICIAL" | "DRAFT" = "OFFICIAL",
    committee = false,
  ): ReportRequest => ({
    filters: {
      termId: ids.term,
      ...(committee ? { committeeId: result.cg.committeeId } : {}),
    },
    templateCode: code,
    templateVersion: policy.templates.find(t => t.code === code)!.version,
    mode,
  });
  const preview = (b = request(), actor = ids.faculty) =>
    service.preview(actor, b);
  const body = async (b = request(), actor = ids.faculty) => ({
    ...b,
    expectedSnapshotHash: (await preview(b, actor)).snapshotHash,
  });
  return {
    result,
    users: result.users,
    policy,
    permit,
    control,
    reader,
    session,
    repo,
    renderer,
    realRenderer,
    templates,
    service,
    request,
    preview,
    body,
    get state() {
      return state;
    },
  };
}
