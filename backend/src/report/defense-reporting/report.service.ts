import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID, createHash } from "crypto";
import {
  ReportExportSchema,
  ReportFilterSchema,
  ReportPreviewSchema,
} from "@doan/shared";
import type {
  ReportExport,
  ReportExportMetadata,
  ReportFilter,
  ReportPreview,
  ReportRequest,
} from "@doan/shared";
import { z } from "zod";
import { ReportRepository, ReportSession } from "./report.repository";
import { ReportReader } from "./report.reader";
import { ReportRenderer } from "./report-renderer";
import {
  ReportTemplates,
  contentActions,
  resultReport,
} from "./report-templates";
import { reportStatistics } from "./report-statistics";
import { reviewHash } from "../../topic/proposal-reviews/proposal-review.validator";
import { committeeJson } from "../../defense/committees/committee.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
function block(code: string, message = code): never {
  return groupError(409, code, message);
}
const metadataSchema = z
  .object({
    id: z.string().uuid(),
    actor: z.string().min(1).max(36),
    termId: z.string().min(1).max(36),
    templateCode: ReportExportSchema.shape.templateCode,
    templateVersion: z.string(),
    mode: z.enum(["DRAFT", "OFFICIAL"]),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    count: z.number().int().nonnegative(),
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    scopeHash: z.string().regex(/^[a-f0-9]{64}$/),
    fileHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    sizeBytes: z.number().int().positive().nullable(),
    filename: z.string().regex(/^uc25-[A-Z_]+-[a-f0-9-]{36}\.(xlsx|pdf)$/),
    status: z.enum(["GENERATED", "GENERATION_FAILED"]),
    signatureStatus: z.literal("UNSIGNED"),
    request: ReportExportSchema,
    errorCode: z.string().nullable(),
  })
  .strict();
@Injectable()
export class ReportService {
  private activeRenders = 0;
  constructor(
    private readonly repo: ReportRepository,
    private readonly reader: ReportReader,
    private readonly templates: ReportTemplates,
    private readonly renderer: ReportRenderer,
    private readonly config: ConfigService,
  ) {}
  private enabled() {
    if (this.config.get("UC25_WRITES_ENABLED", "false") !== "true")
      block(
        "UC25_NOT_ENABLED",
        "Chưa được nhóm phê duyệt bật ghi metadata/audit xuất báo cáo.",
      );
  }
  private key(key: string) {
    if (!key || !/^[\w.-]{1,200}$/.test(key))
      groupError(400, "COMMON_003", "Cần Idempotency-Key hợp lệ.");
  }
  async options(actor: string, filters: Partial<ReportFilter> = {}) {
    return this.repo.read(async (s) => {
      const u = await s.principal(actor);
      if (!u || u.status !== "ACTIVE")
        groupError(401, "AUTH_003", "Cần tài khoản hoạt động.");
      const faculty = this.reader.has(u, "FACULTY", "read"),
        lecturer =
          !!u.lecturer?.isActive && this.reader.has(u, "LECTURER", "read");
      if (!faculty && !lecturer)
        groupError(403, "AUTH_004", "Thiếu quyền báo cáo học vụ.");
      const ids = new Set<string>();
      if (faculty)
        for (const g of await s.grants(actor))
          if (g.allDepartments || g.pr2bGrantDepartmentGrantId.length)
            ids.add(g.termId);
      if (lecturer && (await s.ccReady()))
        for (const item of await s.cgTermIds(u.lecturer!.id))
          ids.add(item.committee.termId);
      const terms = await s.terms({ id: { in: [...ids] } });
      const committees: {
        id: string;
        termId: string;
        code: string | null;
        name: string;
      }[] = [];
      if (await s.ccReady())
        for (const termId of ids)
          for (const row of await s.ccList(termId)) {
            try {
              await this.reader.access(
                s,
                actor,
                { termId, committeeId: row.id },
                "read",
              );
              committees.push({
                id: row.id,
                termId,
                code: row.code,
                name: row.name,
              });
            } catch (e) {
              if (
                !(e instanceof HttpException) ||
                ![403, 404, 409].includes(e.getStatus())
              )
                throw e;
            }
          }
      const empty = {
        terms,
        committees,
        departments: [],
        classes: [],
        members: [],
        permissions: [
          ...new Set(
            u.userRoles
              .filter((r) =>
                faculty
                  ? r.role.name === "FACULTY"
                  : r.role.name === "LECTURER",
              )
              .flatMap((r) =>
                r.role.rolePermissions
                  .filter((p) => p.permission.resource === "defense-report")
                  .map((p) => p.permission.action),
              ),
          ),
        ],
        blockers: [] as string[],
      };
      if (!filters.termId || (lecturer && !faculty && !filters.committeeId))
        return empty;
      const f = ReportFilterSchema.parse(filters),
        a = await this.reader.access(s, actor, f, "read"),
        snapshot = await this.reader.collect(
          s,
          a,
          f,
          null,
          this.templates.policy((await s.rpPolicy(f.termId))?.value)
            ?.memberResults === "EXPLICIT_RESULT_PERMISSION",
          false,
        );
      return {
        ...empty,
        departments: [
          ...new Set(snapshot.facts.map((f) => f.department).filter(Boolean)),
        ].map((id) => ({ id, name: id })),
        classes: [...new Set(snapshot.facts.map((f) => f.className))],
        members: snapshot.facts.map((f) => ({
          id: f.memberId,
          name: f.row.cells.STUDENT_NAME ?? "",
          code: f.row.cells.STUDENT_CODE ?? "",
        })),
        blockers: this.templates.policy((await s.rpPolicy(f.termId))?.value)
          ? []
          : ["UC25_POLICY_REQUIRED"],
      };
    });
  }
  async templateList(actor: string, f: ReportFilter) {
    return this.repo.read(async (s) => {
      const a = await this.reader.access(s, actor, f, "templates-read"),
        p = this.templates.policy((await s.rpPolicy(f.termId))?.value);
      return {
        templates: this.templates
          .all(p)
          .filter((t) => t.roles.includes(a.role)),
        blockers: p ? [] : ["UC25_POLICY_REQUIRED"],
      };
    });
  }
  statistics(actor: string, input: ReportFilter) {
    const f = ReportFilterSchema.parse(input);
    return this.repo.read(async (s) => {
      const a = await this.reader.access(s, actor, f, "statistics"),
        p = this.templates.policy((await s.rpPolicy(f.termId))?.value),
        snapshot = await this.reader.collect(
          s,
          a,
          f,
          null,
          p?.memberResults === "EXPLICIT_RESULT_PERMISSION",
        );
      return reportStatistics(
        snapshot,
        this.reader.has(a.u, a.role, "grade-statistics"),
        this.reader.has(a.u, a.role, "score-statistics"),
        p,
      );
    });
  }
  private async prepared(
    s: ReportSession,
    actor: string,
    b: ReportRequest,
    action: string,
  ) {
    if (b.filters.lecturerId && b.templateCode !== "PDF_REVIEWER_GRADE")
      groupError(
        400,
        "COMMON_003",
        "Bộ lọc giảng viên chỉ dành cho phiếu GVPB.",
      );
    const a = await this.reader.access(s, actor, b.filters, action),
      policy = this.templates.policy(
        (await s.rpPolicy(b.filters.termId))?.value,
      ),
      template = this.templates
        .all(policy)
        .find((t) => t.code === b.templateCode)!;
    if (!template.roles.includes(a.role))
      groupError(403, "AUTH_004", "Mẫu không dành cho vai trò này.");
    for (const permission of contentActions(template))
      if (!this.reader.has(a.u, a.role, permission))
        groupError(
          403,
          "AUTH_004",
          "Thiếu quyền nội dung báo cáo: " + permission,
        );
    if (
      b.mode === "DRAFT" &&
      !this.reader.has(
        a.u,
        a.role,
        action === "preview" ? "draft-preview" : "draft-export",
      )
    )
      groupError(403, "AUTH_004", "Thiếu quyền dùng bản DRAFT.");
    const blockers = this.templates.blockers(template, b.mode, policy);
    if (template.version !== b.templateVersion)
      block("TEMPLATE_VERSION_MISMATCH");
    const snapshot = await this.reader.collect(
      s,
      a,
      b.filters,
      template,
      policy?.memberResults === "EXPLICIT_RESULT_PERMISSION",
    );
    blockers.push(...snapshot.blockers);
    const rawRows = snapshot.rows;
    for (const row of rawRows)
      for (const missing of row.missing) {
        if (
          b.mode === "OFFICIAL"
            ? !template.allowMissing.includes(missing as never)
            : !policy?.incompleteDraft &&
              !template.allowMissing.includes(missing as never)
        )
          blockers.push("MISSING_SOURCE:" + missing);
      }
    // Never leak internally read scores/comments through preview columns or an alternate template.
    const rows = rawRows.map((row) => ({
      ...row,
      cells: Object.fromEntries(
        template.columns.map((c) => [c, row.cells[c] ?? ""]),
      ),
    }));
    snapshot.rows = rows;
    if (resultReport(template.code) && b.mode === "DRAFT")
      for (const row of rows)
        if (row.sourceState !== "CURRENT") {
          delete row.cells.FINAL_SCORE;
          delete row.cells.ADVISOR_SCORE;
          delete row.cells.REVIEWER_SCORE;
          delete row.cells.COMMITTEE_SCORE;
          delete row.cells.MEMBER_SCORES;
          delete row.cells.REVIEWER_SCORES;
        }
    if (
      Buffer.byteLength(JSON.stringify(rows)) >
        this.config.get<number>("UC25_MAX_BYTES", 10 * 1024 * 1024) ||
      JSON.stringify(rows).length >
        this.config.get<number>("UC25_MAX_TEXT_CHARS", 200000)
    )
      block("REPORT_LIMIT_EXCEEDED");
    const snapshotHash = reviewHash({
      source: snapshot.hash,
      rows,
      template,
      policy,
      mode: b.mode,
      filters: b.filters,
      actor,
      role: a.role,
    });
    const preview: ReportPreview = {
      template,
      mode: b.mode,
      snapshotHash,
      rows: rows.slice(0, 20),
      count: rows.length,
      truncated: rows.length > 20,
      blockers: [...new Set(blockers)],
      canExport:
        blockers.length === 0 &&
        this.config.get("UC25_WRITES_ENABLED", "false") === "true",
      signatureStatus: "UNSIGNED",
    };
    if (this.config.get("UC25_WRITES_ENABLED", "false") !== "true")
      preview.blockers.push("UC25_NOT_ENABLED");
    return { a, policy, template, snapshot, snapshotHash, preview };
  }
  preview(actor: string, body: ReportRequest) {
    const b = ReportPreviewSchema.parse(body);
    return this.repo.read(
      async (s) => (await this.prepared(s, actor, b, "preview")).preview,
    );
  }
  private async render(
    d: Awaited<ReturnType<ReportService["prepared"]>>,
    b: ReportRequest,
    id: string,
    at: string,
    actor: string,
  ) {
    if (
      this.activeRenders >=
      this.config.get<number>("UC25_MAX_ACTIVE_RENDERS", 2)
    )
      block("REPORT_BUSY", "Máy chủ đang tạo báo cáo; thử lại sau.");
    this.activeRenders++;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const task = this.renderer
      .render(d.snapshot, d.template, b, id, at, actor)
      .finally(() => {
        this.activeRenders--;
      });
    try {
      const bytes = await Promise.race([
        task,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(Error("RENDER_TIMEOUT")),
            this.config.get<number>("UC25_RENDER_TIMEOUT_MS", 30000),
          );
        }),
      ]);
      if (
        bytes.length >
        this.config.get<number>("UC25_MAX_BYTES", 10 * 1024 * 1024)
      )
        throw Error("FILE_LIMIT_EXCEEDED");
      return bytes;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  private async metadata(s: ReportSession, actor: string, id: string) {
    const event = await s.rpMetadata(id, actor),
      parsed = metadataSchema.safeParse(event?.newValue);
    if (!parsed.success || parsed.data.actor !== actor || parsed.data.id !== id)
      groupError(404, "COMMON_001", "Không tìm thấy bản xuất.");
    return parsed.data;
  }
  async export(
    actor: string,
    input: ReportExport,
    key: string,
  ): Promise<ReportExportMetadata> {
    const b = ReportExportSchema.parse(input);
    this.key(key);
    this.enabled();
    const route = "/defense-reports/exports",
      hash = reviewHash(b);
    const initial = await this.repo.read(async (s) => {
      const d = await this.prepared(s, actor, b, "export");
      if (d.preview.blockers.length)
        block("REPORT_BLOCKED", d.preview.blockers.join("; "));
      if (b.expectedSnapshotHash !== d.snapshotHash)
        block("REPORT_SOURCE_CHANGED");
      const replay = await s.replay(actor, route, key);
      if (replay && replay.payloadHash !== hash) block("IDEMPOTENCY_CONFLICT");
      return { d, replay };
    });
    if (initial.replay) {
      const parsed = metadataSchema.safeParse(initial.replay.result);
      if (!parsed.success) block("EXPORT_LEGACY_UNVERIFIED");
      if (parsed.data.status !== "GENERATED") block("GENERATION_FAILED");
      if (Date.parse(parsed.data.expiresAt) <= Date.now())
        block("EXPORT_EXPIRED");
      return parsed.data;
    }
    const id = randomUUID(),
      at = new Date().toISOString();
    let bytes: Buffer | null = null;
    try {
      bytes = await this.render(initial.d, b, id, at, actor);
    } catch {
      /* Persist a redacted failure below; never success. */
    }
    const metadata: ReportExportMetadata = {
      id,
      actor,
      termId: b.filters.termId,
      templateCode: b.templateCode,
      templateVersion: b.templateVersion,
      mode: b.mode,
      createdAt: at,
      expiresAt: new Date(
        Date.parse(at) + initial.d.policy!.retentionDays * 86400000,
      ).toISOString(),
      count: initial.d.snapshot.rows.length,
      snapshotHash: initial.d.snapshotHash,
      scopeHash: reviewHash({
        actor,
        role: initial.d.a.role,
        departments: initial.d.a.departments,
        committeeId: initial.d.a.committee?.committeeId ?? null,
      }),
      fileHash: bytes ? digest(bytes) : null,
      sizeBytes: bytes?.length ?? null,
      filename: `uc25-${b.templateCode}-${id}.${initial.d.template.format === "PDF" ? "pdf" : "xlsx"}`,
      status: bytes ? "GENERATED" : "GENERATION_FAILED",
      signatureStatus: "UNSIGNED",
      request: b,
      errorCode: bytes ? null : "GENERATION_FAILED",
    };
    const saved = await this.repo.write(async (s) => {
      this.enabled();
      await s.ccLock(b.filters.termId);
      const d = await this.prepared(s, actor, b, "export");
      if (
        d.preview.blockers.length ||
        d.snapshotHash !== initial.d.snapshotHash
      )
        block("REPORT_SOURCE_CHANGED");
      const replay = await s.replay(actor, route, key);
      if (replay) {
        if (replay.payloadHash !== hash) block("IDEMPOTENCY_CONFLICT");
        return metadataSchema.parse(replay.result);
      }
      await s.rpEvent(
        actor,
        id,
        bytes ? "EXPORT_GENERATED" : "GENERATION_FAILED",
        metadata,
      );
      await s.remember(actor, route, key, hash, committeeJson(metadata));
      return metadata;
    });
    if (saved.status !== "GENERATED")
      block(
        "GENERATION_FAILED",
        "Tạo file thất bại; không có bản xuất thành công.",
      );
    return saved;
  }
  detail(actor: string, id: string) {
    return this.repo.read(async (s) => {
      const m = await this.metadata(s, actor, id);
      const d = await this.prepared(s, actor, m.request, "history-read");
      if (
        m.scopeHash !==
        reviewHash({
          actor,
          role: d.a.role,
          departments: d.a.departments,
          committeeId: d.a.committee?.committeeId ?? null,
        })
      )
        groupError(404, "COMMON_001", "Bản xuất ngoài phạm vi hiện tại.");
      return {
        ...m,
        current:
          d.snapshotHash === m.snapshotHash &&
          d.preview.blockers.filter((x) => x !== "UC25_NOT_ENABLED").length ===
            0,
        expired: Date.parse(m.expiresAt) <= Date.now(),
      };
    });
  }
  history(actor: string, f: ReportFilter) {
    return this.repo.read(async (s) => {
      await this.reader.access(s, actor, f, "history-read");
      const rows = await s.rpHistory(actor, f.termId);
      const visible: {
        id: string;
        templateCode: string;
        templateVersion: string;
        mode: string;
        status: string;
        createdAt: string;
        count: number;
      }[] = [];
      for (const event of rows) {
        const parsed = metadataSchema.safeParse(event.newValue);
        if (!parsed.success) continue;
        const m = parsed.data;
        if (
          (f.committeeId && m.request.filters.committeeId !== f.committeeId) ||
          (f.departmentId &&
            m.request.filters.departmentId !== f.departmentId) ||
          (f.className && m.request.filters.className !== f.className)
        )
          continue;
        try {
          const a = await this.reader.access(
            s,
            actor,
            m.request.filters,
            "history-read",
          );
          if (
            m.scopeHash !==
            reviewHash({
              actor,
              role: a.role,
              departments: a.departments,
              committeeId: a.committee?.committeeId ?? null,
            })
          )
            continue;
          visible.push({
            id: m.id,
            templateCode: m.templateCode,
            templateVersion: m.templateVersion,
            mode: m.mode,
            status: m.status,
            createdAt: m.createdAt,
            count: m.count,
          });
        } catch (e) {
          if (
            !(e instanceof HttpException) ||
            ![403, 404, 409].includes(e.getStatus())
          )
            throw e;
        }
      }
      return visible;
    });
  }
  async download(actor: string, id: string, key: string) {
    this.key(key);
    this.enabled();
    const route = `/defense-reports/exports/${id}/download`,
      payloadHash = reviewHash({ id });
    const initial = await this.repo.read(async (s) => {
      const m = await this.metadata(s, actor, id),
        d = await this.prepared(s, actor, m.request, "download");
      if (m.status !== "GENERATED" || Date.parse(m.expiresAt) <= Date.now())
        block("EXPORT_EXPIRED_OR_FAILED");
      if (d.preview.blockers.length || d.snapshotHash !== m.snapshotHash)
        block("REPORT_SOURCE_CHANGED");
      return { m, d };
    });
    let bytes: Buffer;
    try {
      bytes = await this.render(
        initial.d,
        initial.m.request,
        id,
        initial.m.createdAt,
        actor,
      );
    } catch {
      block("GENERATION_FAILED");
    }
    if (digest(bytes) !== initial.m.fileHash)
      block(
        "ARTIFACT_HASH_MISMATCH",
        "Nội dung file không khớp bản xuất; cần xuất mới.",
      );
    await this.repo.write(async (s) => {
      this.enabled();
      await s.ccLock(initial.m.termId);
      const m = await this.metadata(s, actor, id),
        d = await this.prepared(s, actor, m.request, "download");
      if (
        d.preview.blockers.length ||
        d.snapshotHash !== m.snapshotHash ||
        Date.parse(m.expiresAt) <= Date.now()
      )
        block("REPORT_SOURCE_CHANGED");
      const replay = await s.replay(actor, route, key);
      if (replay) {
        if (replay.payloadHash !== payloadHash) block("IDEMPOTENCY_CONFLICT");
        return;
      }
      await s.rpEvent(actor, id, "DELIVERY_PREPARED", {
        actor,
        termId: m.termId,
        templateCode: m.templateCode,
        templateVersion: m.templateVersion,
        count: m.count,
        snapshotHash: m.snapshotHash,
        fileHash: digest(bytes),
        status: "DELIVERY_PREPARED",
        at: new Date().toISOString(),
      });
      await s.remember(
        actor,
        route,
        key,
        payloadHash,
        committeeJson({ id, fileHash: digest(bytes) }),
      );
    });
    return {
      bytes,
      filename: initial.m.filename,
      contentType:
        initial.d.template.format === "PDF"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }
}
