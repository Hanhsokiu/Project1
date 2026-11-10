import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import {
  ScheduleBatchSchema,
  ScheduleCommandSchema,
  ScheduleSaveSchema,
} from "@doan/shared";
import type {
  ScheduleBatch,
  ScheduleCommand,
  SchedulePolicy,
  ScheduleProposal,
  ScheduleQuery,
  ScheduleRoom,
  ScheduleSave,
  ScheduleSource,
  ScheduleView,
  ScheduleWorkspace,
} from "@doan/shared";
import {
  ScheduleRecord,
  ScheduleRepository,
  ScheduleSession,
  scheduleSnapshot,
} from "./schedule.repository";
import { ScheduleValidator } from "./schedule.validator";
import { ScheduleContext, scheduleContext } from "./schedule-context";
import {
  Booking,
  bookingConflicts,
  buildSession,
  localParts,
  proposeSchedule,
} from "./schedule-engine";
import { CommitteeWorkflowService } from "../committees/committee-workflow.service";
import { ReviewerService } from "../reviewers/reviewer.service";
import { CommitteeValidator } from "../committees/committee.validator";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import { GuidanceValidator } from "../../guidance/tasks/guidance.validator";
import type { ReviewPrincipal } from "../../topic/proposal-reviews/proposal-review.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
import { committeeJson } from "../committees/committee.repository";
import { operationWindow } from "../../term/service/term-window.service";
const missing = (): never =>
  groupError(
    404,
    "COMMON_001",
    "Không tìm thấy lịch/hội đồng/phòng trong phạm vi được cấp quyền.",
  );
const sourceBinding = (c: ScheduleSource) => ({
  committeeId: c.committeeId,
  committeeRevision: c.committeeRevision,
  committeeEvidenceHash: c.committeeEvidenceHash,
  sourceHash: c.sourceHash,
});
const permissionBlock = "FACULTY_PERMISSION_REQUIRED";
const selectedSourceIssues = (source: ScheduleSource, ids: string[]) =>
  source.issues.filter(
    (v) =>
      !v.startsWith("UC20_CURRENT_REVIEWERS_REQUIRED:") ||
      ids.includes(v.split(":")[1]),
  );
@Injectable()
export class ScheduleService {
  constructor(
    private readonly repo: ScheduleRepository,
    private readonly committees: CommitteeWorkflowService,
    private readonly reviewers: ReviewerService,
    private readonly review: ProposalReviewValidator,
    private readonly roles: GuidanceValidator,
    private readonly v: ScheduleValidator,
    private readonly keys: CommitteeValidator,
    private readonly config: ConfigService,
  ) {}
  private has(u: ReviewPrincipal, action: string, role = "FACULTY") {
    return this.roles.role(u, role, "defense-schedule", action);
  }
  private async scope(
    s: ScheduleSession,
    actor: string,
    termId: string,
    action = "read",
  ) {
    const u = this.review.principal(await s.principal(actor));
    if (!this.has(u, "read") || !this.has(u, action))
      groupError(
        403,
        "AUTH_004",
        "Cần quyền xếp lịch thuộc vai trò Khoa/Giáo vụ.",
      );
    const grants = (await s.grants(actor, termId)).filter(
        (g) => g.termId === termId,
      ),
      all = grants.some((g) => g.allDepartments),
      departments = [
        ...new Set(
          grants.flatMap((g) =>
            g.pr2bGrantDepartmentGrantId.map((d) => d.departmentId),
          ),
        ),
      ];
    if (
      !grants.length ||
      (!all && !departments.length) ||
      !(await s.term(termId))
    )
      return missing();
    return {
      u,
      allows: (id: string | null) => all || (!!id && departments.includes(id)),
    };
  }
  private assertNo(issues: string[]) {
    if (issues.length)
      groupError(409, "SCHEDULE_BLOCKED", [...new Set(issues)].join("; "));
  }
  private async records(s: ScheduleSession) {
    if (await s.scReady()) return s.scRecords();
    return (await s.scLegacyReady())
      ? (await s.scLegacy()).map((r) => ({
          ...r,
          revision: 0,
          state: null,
          localDate: null,
          sessionType: null,
          timezone: null,
          endsAt: null,
          context: null,
          createdBy: null,
          updatedBy: null,
          updatedAt: null,
          finalizedBy: null,
          finalizedAt: null,
          publishedBy: null,
          publishedAt: null,
        }))
      : [];
  }
  private async trusted(s: ScheduleSession, r: ScheduleRecord) {
    if (!r.revision || !r.updatedBy || !r.updatedAt || r.updatedAt > new Date())
      return false;
    const c = scheduleContext(r.context);
    if (
      !c ||
      c.booking.id !== r.id ||
      c.booking.committeeId !== r.committeeId ||
      c.booking.roomId !== r.roomId ||
      c.booking.start !== r.scheduledAt.getTime()
    )
      return false;
    return (await s.scEvents(r.id)).some((e) => {
      const v = e.newValue as {
        snapshotHash?: string;
        revision?: number;
      } | null;
      return (
        [
          "SCHEDULE_SAVED",
          "SCHEDULE_FINALIZED",
          "SCHEDULE_PUBLISHED",
          "SCHEDULE_CANCELLED",
        ].includes(e.action) &&
        e.userId === r.updatedBy &&
        v?.revision === r.revision &&
        v.snapshotHash === reviewHash(scheduleSnapshot(r))
      );
    });
  }
  private async ledger(s: ScheduleSession, rows: ScheduleRecord[]) {
    const bookings: Booking[] = [],
      issues: string[] = [];
    const owners = await s.scProposalOwners(
      rows
        .filter((r) => !r.revision)
        .flatMap((r) => r.committeeStudents.map((a) => a.proposalId)),
    );
    for (const r of rows) {
      if (!r.revision) {
        bookings.push({
          id: r.id,
          committeeId: r.committeeId,
          roomId: r.roomId,
          start: -8640000000000000,
          end: 8640000000000000,
          lecturers: r.committee.members.map((m) => ({
            lecturerId: m.lecturerId,
            start: -8640000000000000,
            end: 8640000000000000,
          })),
          students: r.committeeStudents.map((a) => ({
            proposalId: a.proposalId,
            studentId:
              owners.find((p) => p.id === a.proposalId)?.studentId ?? "",
            start: -8640000000000000,
            end: 8640000000000000,
          })),
        });
        continue;
      }
      if (!(await this.trusted(s, r))) {
        issues.push("GLOBAL_SCHEDULE_PROVENANCE_UNVERIFIED");
        continue;
      }
      if (r.state !== "CANCELLED")
        bookings.push(scheduleContext(r.context)!.booking);
    }
    return { bookings, issues: [...new Set(issues)] };
  }
  private async sources(
    s: ScheduleSession,
    actor: string,
    termId: string,
    p: SchedulePolicy | null,
  ) {
    const w = await this.committees.workspaceInSession(s, actor, termId),
      sources: ScheduleSource[] = [];
    const members = [
      ...new Set(
        w.committees.flatMap(
          (c) => c.downstream?.students.map((a) => a.termStudentId) ?? [],
        ),
      ),
    ];
    const identities = await s.scStudentIdentities(members);
    const rw =
      p?.reviewerAttendance === "REQUIRED"
        ? await this.reviewers.workspaceInSession(s, actor, termId)
        : null;
    for (const c of w.committees) {
      if (!c.downstream) continue;
      const effective = await this.committees.effectiveInSession(
        s,
        actor,
        termId,
        c.id,
        c.revision,
        c.downstream.evidenceHash,
      );
      const students = effective.students.flatMap((a) => {
        const m = identities.find(
            (m) => m.id === a.termStudentId && m.termId === termId,
          ),
          display = w.candidates.find(
            (c) => c.termStudentId === a.termStudentId,
          );
        return m && m.student.isActive && display
          ? [
              {
                ...a,
                studentId: m.studentId,
                studentCode: m.student.studentCode,
                studentName: m.student.fullName,
              },
            ]
          : [];
      });
      const issues: string[] =
        students.length === effective.students.length
          ? []
          : ["STUDENT_IDENTITY_REQUIRED"];
      const reviewers: ScheduleSource["reviewers"] = [];
      if (p?.reviewerAttendance === "REQUIRED")
        for (const a of effective.students) {
          const r = rw?.students.find((r) => r.id === a.termStudentId);
          if (!r?.downstream) {
            issues.push(`UC20_CURRENT_REVIEWERS_REQUIRED:${a.termStudentId}`);
            continue;
          }
          reviewers.push(
            ...(await this.reviewers.effectiveInSession(
              s,
              actor,
              termId,
              a.termStudentId,
              r.revision,
              r.evidenceHash,
            )),
          );
        }
      const sourceHash = reviewHash({ effective, students, reviewers });
      sources.push({
        committeeId: c.id,
        committeeRevision: c.revision,
        committeeEvidenceHash: effective.evidenceHash,
        sourceHash,
        code: effective.code,
        departmentId: effective.departmentId,
        members: effective.members.map((m) => m.lecturerId),
        students,
        reviewers,
        issues: [...new Set(issues)],
      });
    }
    return { sources, upstream: w };
  }
  private async load(s: ScheduleSession, actor: string, termId: string) {
    const scope = await this.scope(s, actor, termId),
      ready = await s.scReady(),
      policy = this.v.policy((await s.scPolicy(termId))?.value);
    const { sources, upstream } = await this.sources(s, actor, termId, policy),
      rows = await this.records(s),
      ledger = await this.ledger(s, rows),
      blockers = [...ledger.issues];
    if (!ready) blockers.push("UC21_SCHEMA_REQUIRED");
    if (!policy) blockers.push("UC21_POLICY_REQUIRED");
    if (
      !upstream.schemaReady ||
      !(await s.schemaReady()) ||
      !(await s.eligibilitySchemaReady())
    )
      blockers.push("UPSTREAM_SCHEMA_REQUIRED");
    if (
      upstream.blockers.some((b) =>
        [
          "UC19_POLICY_REQUIRED",
          "UC17_UC18_POLICY_REQUIRED",
          "UC18_READ_PERMISSION_REQUIRED",
        ].includes(b),
      )
    )
      blockers.push("UPSTREAM_POLICY_OR_PERMISSION_REQUIRED");
    if (policy?.reviewerAttendance === "PENDING_APPROVAL")
      blockers.push("REVIEWER_ATTENDANCE_PENDING_APPROVAL");
    if (this.config.get("UC21_WRITES_ENABLED", "false") !== "true")
      blockers.push("UC21_NOT_ENABLED");
    const term = await s.windowTerm(termId),
      window = term && policy ? operationWindow(term, policy.phaseCode) : null,
      defense = term ? operationWindow(term, "DEFENSE") : null;
    if (!window?.canWrite)
      blockers.push(
        window?.reason ?? "Chưa có cửa sổ thao tác UC21 được duyệt.",
      );
    const bounds = {
      start:
        defense?.startAt && term
          ? Math.max(Date.parse(defense.startAt), term.startDate.getTime())
          : NaN,
      end:
        defense?.endAt && term
          ? Math.min(Date.parse(defense.endAt), term.endDate.getTime())
          : NaN,
    };
    if (
      !Number.isFinite(bounds.start) ||
      !Number.isFinite(bounds.end) ||
      defense?.locked
    )
      blockers.push("DEFENSE_PHASE_REQUIRED");
    const rooms: ScheduleRoom[] = (await s.scRooms()).flatMap((r) => {
      const access = policy?.roomAccess.find((a) => a.roomId === r.id);
      return access && access.departmentIds.some((d) => scope.allows(d))
        ? [
            {
              id: r.id,
              code: r.code,
              name: r.name,
              capacity: r.capacity,
              departmentIds: access.departmentIds.filter((d) =>
                scope.allows(d),
              ),
            },
          ]
        : [];
    });
    const scopedRows = rows.filter(
      (r) =>
        r.committee.termId === termId &&
        scope.allows(
          sources.find((c) => c.committeeId === r.committeeId)?.departmentId ??
            upstream.committees.find((c) => c.id === r.committeeId)
              ?.departmentId ??
            null,
        ),
    );
    const schedules: ScheduleView[] = [];
    for (const r of scopedRows) {
      const ctx = scheduleContext(r.context),
        source = sources.find((c) => c.committeeId === r.committeeId),
        room = rooms.find((a) => a.id === r.roomId),
        trusted = await this.trusted(s, r),
        issues: string[] = [];
      let current: ReturnType<typeof buildSession> | null = null;
      if (!source) issues.push("UC19_CURRENT_COMMITTEE_REQUIRED");
      else
        issues.push(
          ...selectedSourceIssues(
            source,
            ctx?.slots.map((a) => a.termStudentId) ?? [],
          ),
        );
      if (!room) issues.push("ROOM_NOT_ALLOWED");
      if (!ctx || !trusted) issues.push("SCHEDULE_PROVENANCE_UNVERIFIED");
      if (!policy || ctx?.policyHash !== reviewHash(policy))
        issues.push("SCHEDULE_POLICY_CHANGED");
      if (
        source &&
        ctx &&
        reviewHash(ctx.source) !== reviewHash(sourceBinding(source))
      )
        issues.push("SCHEDULE_SOURCE_CHANGED");
      if (room && ctx && ctx.roomFactHash !== reviewHash(room))
        issues.push("ROOM_CHANGED");
      if (
        source &&
        room &&
        policy &&
        ctx &&
        r.localDate &&
        (r.sessionType === "MORNING" || r.sessionType === "AFTERNOON")
      ) {
        try {
          current = buildSession({
            source,
            room,
            date: r.localDate,
            period: r.sessionType,
            startTime: localParts(r.scheduledAt).time,
            studentIds: ctx.slots.map((a) => a.termStudentId),
            manualOrder: ctx.manualOrder
              ? ctx.slots.map((a) => a.termStudentId)
              : undefined,
            policy,
            bounds,
          });
          current.booking.id = r.id;
          if (
            reviewHash(current.slots) !== reviewHash(ctx.slots) ||
            current.end !== r.endsAt?.getTime() ||
            reviewHash(current.booking) !== reviewHash(ctx.booking)
          )
            issues.push("SCHEDULE_GEOMETRY_CHANGED");
          issues.push(...bookingConflicts(current.booking, ledger.bookings));
        } catch (e) {
          issues.push(e instanceof Error ? e.message : "SCHEDULE_INVALID");
        }
      }
      if (
        r.state === "FINALIZED" &&
        (!r.finalizedBy || !r.finalizedAt || r.finalizedAt > new Date())
      )
        issues.push("FINALIZATION_PROVENANCE_REQUIRED");
      const evidenceHash = reviewHash({
          source: source ? sourceBinding(source) : null,
          policyHash: reviewHash(policy),
          roomFactHash: reviewHash(room ?? null),
          geometry: current,
        }),
        state: ScheduleView["state"] = !r.revision
          ? "LEGACY_UNVERIFIED"
          : r.state === "CANCELLED"
            ? "CANCELLED"
            : issues.length
              ? "STALE"
              : r.state === "FINALIZED"
                ? "FINALIZED"
                : "DRAFT";
      const base = [
        ...blockers,
        ...(!trusted ? ["SCHEDULE_PROVENANCE_UNVERIFIED"] : []),
        ...(!r.revision ? ["LEGACY_RECONCILIATION_REQUIRED"] : []),
      ];
      const frozen = r.state !== "DRAFT" ? ["SCHEDULE_IMMUTABLE"] : [];
      const events = r.revision ? await s.scEvents(r.id) : [];
      const view: ScheduleView = {
        id: r.id,
        termId,
        committeeId: r.committeeId,
        committeeCode: source?.code ?? r.committee.name,
        roomId: r.roomId,
        roomName: r.room.name,
        date: r.localDate ?? localParts(r.scheduledAt).date,
        period: r.sessionType ?? "LEGACY",
        timezone: r.timezone ?? "UNVERIFIED",
        startAt: r.scheduledAt.toISOString(),
        endAt: r.endsAt?.toISOString() ?? null,
        startTime: localParts(r.scheduledAt).time,
        revision: r.revision,
        state,
        slots: ctx?.slots ?? [],
        automaticOrder: ctx?.automaticOrder ?? [],
        manualOrder: ctx?.manualOrder ?? false,
        evidenceHash,
        finalizedBy: r.finalizedBy,
        finalizedAt: r.finalizedAt?.toISOString() ?? null,
        publishedBy: r.publishedBy,
        publishedAt: r.publishedAt?.toISOString() ?? null,
        issues: [...new Set(issues)],
        blockers: {
          update: [
            ...base,
            ...frozen,
            ...(!this.has(scope.u, "update") ? [permissionBlock] : []),
          ],
          finalize: [
            ...base,
            ...frozen,
            ...issues,
            ...(!this.has(scope.u, "finalize") ? [permissionBlock] : []),
          ],
          publish: [
            ...base,
            ...issues,
            ...(r.state !== "FINALIZED" || r.publishedAt
              ? ["FINALIZED_UNPUBLISHED_REQUIRED"]
              : []),
            ...(!policy || Date.parse(policy.publishNotBefore) > Date.now()
              ? ["PUBLICATION_NOT_OPEN"]
              : []),
            ...(!this.has(scope.u, "publish") ? [permissionBlock] : []),
          ],
        },
        history: events.map((e) => {
          const v = e.newValue as { reason?: string; revision?: number } | null;
          return {
            id: e.id,
            actor: e.userId,
            at: e.createdAt.toISOString(),
            action: e.action,
            reason: v?.reason ?? "",
            revision: v?.revision ?? 0,
          };
        }),
        downstream: null,
      };
      if (
        state === "FINALIZED" &&
        ctx &&
        policy &&
        r.finalizedBy &&
        r.finalizedAt &&
        source &&
        r.endsAt
      )
        view.downstream = {
          termId,
          committeeId: r.committeeId,
          committeeRevision: source.committeeRevision,
          committeeEvidenceHash: source.committeeEvidenceHash,
          sessionId: r.id,
          roomId: r.roomId,
          date: view.date,
          period: r.sessionType as "MORNING" | "AFTERNOON",
          timezone: "Asia/Ho_Chi_Minh",
          startAt: view.startAt,
          endAt: r.endsAt.toISOString(),
          slots: view.slots,
          revision: r.revision,
          finalizedBy: r.finalizedBy,
          finalizedAt: r.finalizedAt.toISOString(),
          publishedBy: r.publishedBy,
          publishedAt: view.publishedAt,
          policyVersion: policy.version,
          policyHash: reviewHash(policy),
          evidenceHash,
          effectiveStatus: "CURRENT",
        };
      schedules.push(view);
    }
    const workspace: ScheduleWorkspace = {
      termId,
      mode: "FACULTY",
      rosterHash: reviewHash({
        rows: rows.map(scheduleSnapshot),
        rooms,
        policy,
        sources,
      }),
      schemaReady: ready,
      policy,
      blockers,
      rooms,
      sources,
      schedules,
      permissions: {
        create: this.has(scope.u, "create"),
        update: this.has(scope.u, "update"),
        finalize: this.has(scope.u, "finalize"),
        publish: this.has(scope.u, "publish"),
      },
    };
    return { workspace, scope, rows, ledger, bounds };
  }
  private personalRelated(
    u: ReviewPrincipal,
    c: ScheduleContext,
    p: SchedulePolicy,
  ) {
    return c.slots.filter(
      (a) =>
        (p.studentVisibility &&
          this.has(u, "read", "STUDENT") &&
          u.student?.isActive &&
          a.studentId === u.student.id) ||
        (p.lecturerVisibility &&
          this.has(u, "read", "LECTURER") &&
          u.lecturer?.isActive &&
          (c.memberIds.includes(u.lecturer.id) ||
            a.reviewerIds.includes(u.lecturer.id) ||
            (p.advisorCanView && a.advisorId === u.lecturer.id))),
    );
  }
  private async personal(
    s: ScheduleSession,
    u: ReviewPrincipal,
    termId: string,
  ): Promise<ScheduleWorkspace> {
    const policy = this.v.policy((await s.scPolicy(termId))?.value),
      schedules: ScheduleView[] = [],
      cache = new Map<string, ScheduleWorkspace>();
    const visible =
      policy &&
      ((this.has(u, "read", "STUDENT") && policy.studentVisibility) ||
        (this.has(u, "read", "LECTURER") && policy.lecturerVisibility));
    if (visible && (await s.scReady()))
      for (const r of await s.scRecords()) {
        const c = scheduleContext(r.context);
        if (
          r.committee.termId !== termId ||
          r.state !== "FINALIZED" ||
          !r.publishedAt ||
          r.publishedAt > new Date() ||
          !r.updatedBy ||
          !c ||
          !this.personalRelated(u, c, policy).length ||
          !(await this.trusted(s, r))
        )
          continue;
        try {
          if (!cache.has(r.updatedBy))
            cache.set(
              r.updatedBy,
              (await this.load(s, r.updatedBy, termId)).workspace,
            );
          const v = cache
            .get(r.updatedBy)!
            .schedules.find((a) => a.id === r.id);
          if (!v?.downstream) continue;
          const slots = this.personalRelated(u, c, policy),
            ids = new Set(slots.map((a) => a.termStudentId));
          schedules.push({
            ...v,
            slots,
            automaticOrder: v.automaticOrder.filter((id) => ids.has(id)),
            history: [],
            downstream: null,
            blockers: {
              update: ["PERSONAL_READ_ONLY"],
              finalize: ["PERSONAL_READ_ONLY"],
              publish: ["PERSONAL_READ_ONLY"],
            },
          });
        } catch (e) {
          if (
            !(e instanceof HttpException) ||
            ![401, 403, 404, 409].includes(e.getStatus())
          )
            throw e;
        }
      }
    return {
      termId,
      mode: "PERSONAL",
      rosterHash: reviewHash(schedules),
      schemaReady: await s.scReady(),
      policy: null,
      blockers: ["PERSONAL_READ_ONLY"],
      rooms: [],
      sources: [],
      schedules,
      permissions: {
        create: false,
        update: false,
        finalize: false,
        publish: false,
      },
    };
  }
  workspace(actor: string, termId: string) {
    return this.repo.read(async (s) => {
      const u = this.review.principal(await s.principal(actor));
      if (this.has(u, "read"))
        return (await this.load(s, actor, termId)).workspace;
      if (!this.has(u, "read", "STUDENT") && !this.has(u, "read", "LECTURER"))
        groupError(403, "AUTH_004", "Thiếu quyền xem lịch.");
      return this.personal(s, u, termId);
    });
  }
  options(actor: string) {
    return this.repo.read(async (s) => {
      const u = this.review.principal(await s.principal(actor));
      if (this.has(u, "read"))
        return s.terms({
          id: {
            in: (await s.grants(actor))
              .filter(
                (g) => g.allDepartments || g.pr2bGrantDepartmentGrantId.length,
              )
              .map((g) => g.termId),
          },
        });
      if (!this.has(u, "read", "STUDENT") && !this.has(u, "read", "LECTURER"))
        groupError(403, "AUTH_004", "Thiếu quyền xem lịch.");
      const terms: string[] = [];
      if (await s.scReady())
        for (const term of [
          ...new Set((await s.scRecords()).map((r) => r.committee.termId)),
        ])
          if ((await this.personal(s, u, term)).schedules.length)
            terms.push(term);
      return s.terms({ id: { in: terms } });
    });
  }
  async list(actor: string, q: ScheduleQuery) {
    const w = await this.workspace(actor, q.termId),
      needle = q.search.normalize("NFC").toLocaleLowerCase("vi");
    const items = w.schedules
      .filter(
        (c) =>
          (!q.date || c.date === q.date) &&
          (!q.period || c.period === q.period) &&
          (!q.committeeId || c.committeeId === q.committeeId) &&
          (!q.roomId || c.roomId === q.roomId) &&
          (!q.state || c.state === q.state) &&
          (!needle ||
            c.slots.some((a) =>
              `${a.studentCode} ${a.studentName}`
                .normalize("NFC")
                .toLocaleLowerCase("vi")
                .includes(needle),
            )),
      )
      .sort(
        (a, b) =>
          a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id),
      );
    return {
      items: items.slice((q.page - 1) * q.limit, q.page * q.limit),
      total: items.length,
      page: q.page,
      limit: q.limit,
      blockers: w.blockers,
    };
  }
  async detail(actor: string, id: string, termId: string) {
    return (
      (await this.workspace(actor, termId)).schedules.find(
        (c) => c.id === id,
      ) ?? missing()
    );
  }
  private async command(
    actor: string,
    termId: string,
    action: string,
    route: string,
    body: unknown,
    key: string,
    ids: string[],
    fn: (s: ScheduleSession) => Promise<unknown>,
  ) {
    this.keys.key(key);
    return this.repo.write(async (s) => {
      await s.scLock(termId);
      await this.scope(s, actor, termId, action);
      if (!(await s.scReady()) || !(await s.ccReady()))
        groupError(
          409,
          "UC21_SCHEMA_REQUIRED",
          "Cần schema UC19/UC21 đã review/kiểm chứng.",
        );
      const old = await s.replay(actor, route, key),
        hash = reviewHash(body);
      if (old) {
        if (old.payloadHash !== hash)
          groupError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Key đã dùng cho nội dung khác.",
          );
        const w = (await this.load(s, actor, termId)).workspace;
        const result = old.result as { sessions?: { id: string }[] };
        if (
          [...ids, ...(result.sessions?.map((a) => a.id) ?? [])].some(
            (id) => !w.schedules.some((c) => c.id === id),
          )
        )
          return missing();
        return old.result;
      }
      const result = await fn(s);
      await s.remember(actor, route, key, hash, committeeJson(result));
      return result;
    });
  }
  private async event(
    s: ScheduleSession,
    actor: string,
    id: string,
    action: string,
    reason: string,
    old: unknown,
  ) {
    const saved = (await s.scRecords()).find((r) => r.id === id)!;
    await s.scEvent(actor, id, action, old, {
      snapshotHash: reviewHash(scheduleSnapshot(saved)),
      reason,
      revision: saved.revision,
    });
    return { id, revision: saved.revision };
  }
  save(actor: string, id: string | null, input: ScheduleSave, key: string) {
    const b = ScheduleSaveSchema.parse(input);
    return this.saveBatch(
      actor,
      {
        termId: b.termId,
        rosterHash: b.rosterHash,
        reason: b.reason,
        sessions: [{ id, body: b }],
      },
      key,
      id ? `/defense-schedules/${id}/update` : "/defense-schedules",
    );
  }
  preview(actor: string, id: string | null, input: ScheduleSave) {
    const b = ScheduleSaveSchema.parse(input);
    return this.repo.read(async (s) => {
      const d = await this.load(s, actor, b.termId),
        w = d.workspace;
      if (id && !w.schedules.some((c) => c.id === id)) return missing();
      this.assertNo(w.blockers.filter((v) => v !== "UC21_NOT_ENABLED"));
      const source = w.sources.find((c) => c.committeeId === b.committeeId),
        room = w.rooms.find((r) => r.id === b.roomId);
      if (!source || !room) return missing();
      this.assertNo(selectedSourceIssues(source, b.termStudentIds));
      if (
        b.rosterHash !== w.rosterHash ||
        reviewHash(sourceBinding(source)) !==
          reviewHash({
            committeeId: b.committeeId,
            committeeRevision: b.committeeRevision,
            committeeEvidenceHash: b.committeeEvidenceHash,
            sourceHash: b.sourceHash,
          })
      )
        groupError(
          409,
          "SCHEDULE_SOURCE_CHANGED",
          "Nguồn đã thay đổi; tải lại.",
        );
      try {
        const built = buildSession({
          source,
          room,
          date: b.date,
          period: b.period,
          startTime: b.startTime,
          studentIds: b.termStudentIds,
          manualOrder: b.manualOrder,
          policy: w.policy!,
          bounds: d.bounds,
        });
        built.booking.id = id ?? "new-preview";
        return {
          rosterHash: w.rosterHash,
          slots: built.slots,
          automaticOrder: built.automaticOrder,
          startAt: new Date(built.start).toISOString(),
          endAt: new Date(built.end).toISOString(),
          issues: bookingConflicts(built.booking, d.ledger.bookings),
        };
      } catch (e) {
        if (e instanceof HttpException) throw e;
        groupError(
          409,
          "SCHEDULE_INVALID",
          e instanceof Error ? e.message : "Lịch không hợp lệ.",
        );
      }
    });
  }
  saveBatch(
    actor: string,
    input: ScheduleBatch,
    key: string,
    route = "/defense-schedules/assignments",
  ) {
    const b = ScheduleBatchSchema.parse(input),
      action = b.sessions.some((c) => !c.id) ? "create" : "update";
    return this.command(
      actor,
      b.termId,
      action,
      route,
      b,
      key,
      b.sessions.flatMap((c) => (c.id ? [c.id] : [])),
      async (s) => {
        const d = await this.load(s, actor, b.termId),
          w = d.workspace;
        this.assertNo(w.blockers);
        if (w.rosterHash !== b.rosterHash)
          groupError(
            409,
            "ROSTER_CHANGED",
            "Lịch/nguồn/phòng đã thay đổi; tải lại.",
          );
        const changing = b.sessions.flatMap((c) => (c.id ? [c.id] : [])),
          bookings = d.ledger.bookings.filter((c) => !changing.includes(c.id)),
          results = [];
        for (const item of b.sessions) {
          const p = item.body,
            id = item.id ?? randomUUID(),
            old = w.schedules.find((c) => c.id === item.id),
            raw = d.rows.find((c) => c.id === item.id);
          if (item.id && !old) return missing();
          if (old) {
            if (!w.permissions.update)
              groupError(403, "AUTH_004", "Thiếu quyền sửa lịch.");
            this.review.revision(old.revision, p.expectedRevision);
            this.assertNo(old.blockers.update);
          } else this.review.revision(0, p.expectedRevision);
          const source = w.sources.find((c) => c.committeeId === p.committeeId),
            room = w.rooms.find((r) => r.id === p.roomId);
          if (!source || !room) return missing();
          this.assertNo(selectedSourceIssues(source, p.termStudentIds));
          if (
            reviewHash(sourceBinding(source)) !==
            reviewHash({
              committeeId: p.committeeId,
              committeeRevision: p.committeeRevision,
              committeeEvidenceHash: p.committeeEvidenceHash,
              sourceHash: p.sourceHash,
            })
          )
            groupError(
              409,
              "SCHEDULE_SOURCE_CHANGED",
              "Nguồn UC18/UC19/UC20 đã thay đổi.",
            );
          let built: ReturnType<typeof buildSession>;
          try {
            built = buildSession({
              source,
              room,
              date: p.date,
              period: p.period,
              startTime: p.startTime,
              studentIds: p.termStudentIds,
              manualOrder: p.manualOrder,
              policy: w.policy!,
              bounds: d.bounds,
            });
          } catch (e) {
            groupError(
              409,
              "SCHEDULE_INVALID",
              e instanceof Error ? e.message : "Lịch không hợp lệ.",
            );
          }
          built.booking.id = id;
          this.assertNo(bookingConflicts(built.booking, bookings));
          bookings.push(built.booking);
          const ctx: ScheduleContext = {
            origin: "UC21",
            source: sourceBinding(source),
            policyVersion: w.policy!.version,
            policyHash: reviewHash(w.policy),
            roomFactHash: reviewHash(room),
            evidenceHash: reviewHash({
              source: sourceBinding(source),
              policyHash: reviewHash(w.policy),
              roomFactHash: reviewHash(room),
              geometry: built,
            }),
            slots: built.slots,
            automaticOrder: built.automaticOrder,
            manualOrder: !!p.manualOrder,
            memberIds: source.members,
            booking: built.booking,
          };
          await s.scSave(id, p.expectedRevision, "DRAFT", {
            id,
            committeeId: p.committeeId,
            roomId: p.roomId,
            scheduledAt: new Date(built.start),
            endsAt: new Date(built.end),
            durationMin: w.policy!.durationMin,
            revision: p.expectedRevision + 1,
            state: "DRAFT",
            localDate: p.date,
            sessionType: p.period,
            timezone: w.policy!.timezone,
            context: committeeJson(ctx),
            createdBy: raw?.createdBy ?? actor,
            updatedBy: actor,
            updatedAt: new Date(),
            finalizedBy: null,
            finalizedAt: null,
            publishedBy: null,
            publishedAt: null,
          });
          results.push(
            await this.event(
              s,
              actor,
              id,
              "SCHEDULE_SAVED",
              b.reason,
              raw ? scheduleSnapshot(raw) : null,
            ),
          );
        }
        return { sessions: results };
      },
    );
  }
  transition(
    actor: string,
    input: ScheduleCommand,
    key: string,
    action: "finalize" | "publish" | "cancel",
  ) {
    const b = ScheduleCommandSchema.parse(input),
      permission = action === "cancel" ? "update" : action;
    return this.command(
      actor,
      b.termId,
      permission,
      `/defense-schedules/${action}`,
      b,
      key,
      b.members.map((m) => m.id),
      async (s) => {
        const d = await this.load(s, actor, b.termId),
          w = d.workspace;
        if (w.rosterHash !== b.rosterHash)
          groupError(
            409,
            "ROSTER_CHANGED",
            "Lịch/nguồn/phòng đã thay đổi; tải lại.",
          );
        this.assertNo(w.blockers);
        const results = [];
        for (const m of b.members) {
          const c = w.schedules.find((c) => c.id === m.id),
            raw = d.rows.find((r) => r.id === m.id);
          if (!c || !raw) return missing();
          this.review.revision(c.revision, m.expectedRevision);
          if (c.evidenceHash !== m.evidenceHash)
            groupError(
              409,
              "SCHEDULE_EVIDENCE_CHANGED",
              "Chứng cứ lịch đã thay đổi.",
            );
          this.assertNo(
            action === "cancel"
              ? c.blockers.update
              : action === "finalize"
                ? c.blockers.finalize
                : c.blockers.publish,
          );
          const now = new Date();
          await s.scSave(
            c.id,
            c.revision,
            action === "publish" ? "FINALIZED" : "DRAFT",
            {
              ...scheduleSnapshot(raw),
              context: committeeJson(raw.context),
              updatedBy: actor,
              updatedAt: now,
              state: action === "cancel" ? "CANCELLED" : "FINALIZED",
              finalizedBy: action === "finalize" ? actor : raw.finalizedBy,
              finalizedAt: action === "finalize" ? now : raw.finalizedAt,
              publishedBy: action === "publish" ? actor : raw.publishedBy,
              publishedAt: action === "publish" ? now : raw.publishedAt,
            },
          );
          results.push(
            await this.event(
              s,
              actor,
              c.id,
              action === "cancel"
                ? "SCHEDULE_CANCELLED"
                : action === "finalize"
                  ? "SCHEDULE_FINALIZED"
                  : "SCHEDULE_PUBLISHED",
              b.reason,
              scheduleSnapshot(raw),
            ),
          );
        }
        return { sessions: results };
      },
    );
  }
  async propose(
    actor: string,
    termId: string,
    requested?: string,
  ): Promise<ScheduleProposal> {
    // Fetch/revalidate evidence in a short read transaction; search runs after it closes.
    const d = await this.repo.read((s) => this.load(s, actor, termId)),
      w = d.workspace;
    if (!w.permissions.create)
      groupError(403, "AUTH_004", "Thiếu quyền đề xuất lịch.");
    const base = {
      rosterHash: w.rosterHash,
      sessions: [],
      previews: [],
      exploredNodes: 0,
    };
    const issues = w.blockers.filter((b) => b !== "UC21_NOT_ENABLED");
    if (issues.length || !w.policy)
      return { ...base, status: "BLOCKED", reasons: issues };
    const ids = requested
        ? [...new Set(requested.split(",").filter(Boolean))]
        : w.sources.map((c) => c.committeeId),
      sources = ids.map((id) => w.sources.find((c) => c.committeeId === id));
    if (sources.some((c) => !c)) return missing();
    if (sources.some((c) => c!.issues.length))
      return {
        ...base,
        status: "BLOCKED",
        reasons: [...new Set(sources.flatMap((c) => c!.issues))],
      };
    if (sources.reduce((n, c) => n + c!.students.length, 0) > 200)
      groupError(400, "COMMON_003", "Mỗi đề xuất tối đa 200 sinh viên.");
    const result = proposeSchedule({
      sources: sources as ScheduleSource[],
      rooms: w.rooms,
      existing: d.ledger.bookings,
      policy: w.policy,
      bounds: d.bounds,
    });
    return {
      ...base,
      status: result.status,
      exploredNodes: result.exploredNodes,
      reasons:
        result.status === "UNSAT"
          ? [
              "Không có phương án thỏa phòng, người tham dự, sinh viên và cửa sổ buổi.",
            ]
          : result.status === "SEARCH_LIMIT"
            ? ["Đã tới giới hạn tìm kiếm, chưa chứng minh UNSAT."]
            : [],
      sessions: result.plans.map((p) => ({
        termId,
        rosterHash: w.rosterHash,
        expectedRevision: 0,
        reason: "Đề xuất chưa áp dụng",
        ...sourceBinding(p.source),
        roomId: p.room.id,
        date: p.date,
        period: p.period,
        startTime: p.startTime,
        termStudentIds: p.students,
      })),
      previews: result.plans.map((p) => ({
        committeeId: p.source.committeeId,
        roomId: p.room.id,
        date: p.date,
        period: p.period,
        slots: p.result.slots,
      })),
    };
  }
  async effectiveInSession(
    s: ScheduleSession,
    actor: string,
    termId: string,
    id: string,
    expectedRevision: number,
    evidenceHash: string,
  ) {
    const c = (await this.load(s, actor, termId)).workspace.schedules.find(
      (c) => c.id === id,
    );
    if (!c) return missing();
    this.review.revision(c.revision, expectedRevision);
    if (!c.downstream || c.evidenceHash !== evidenceHash)
      groupError(
        409,
        "SCHEDULE_NOT_CURRENT",
        "Lịch chưa chốt hoặc nguồn không còn hiệu lực.",
      );
    return c.downstream;
  }
}
