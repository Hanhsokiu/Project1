import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { FinalResultCommandSchema, calculateFinalResult } from "@doan/shared";
import type {
  EffectiveFinalResult,
  FinalResultCommand,
  FinalResultQuery,
  FinalResultView,
  FinalResultPolicy,
  ResultConfirmation,
  ResultCalculation,
} from "@doan/shared";
import {
  FinalResultRepository,
  FinalResultSession,
  FinalResultRecord,
} from "./final-result.repository";
import { FinalResultSources } from "./final-result.sources";
import { finalResultContext } from "./final-result.context";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import type { ReviewPrincipal } from "../../topic/proposal-reviews/proposal-review.repository";
import { GuidanceValidator } from "../../guidance/tasks/guidance.validator";
import { committeeJson } from "../committees/committee.repository";
import { operationWindow } from "../../term/service/term-window.service";
import { groupError } from "../../topic/review-groups/review-group.errors";
type Context = {
  kind: "UC24";
  termId: string;
  termStudentId: string;
  proposalId: string;
  evidenceHash: string;
  evidence: unknown;
  policy: FinalResultPolicy;
  calculation: ResultCalculation;
  confirmations: ResultConfirmation[];
};
function fail(code: string, message = code): never {
  return groupError(409, code, message);
}
const missing = (): never =>
  groupError(
    404,
    "COMMON_001",
    "Không tìm thấy kết quả trong phạm vi được cấp quyền.",
  );
export function finalResultHash(row: FinalResultRecord) {
  return reviewHash({
    id: row.id,
    proposalId: row.proposalId,
    revision: row.revision,
    state: row.state,
    context: row.context,
    finalScore: row.finalScore?.toString() ?? null,
    isPassed: row.isPassed,
    isLocked: row.isLocked,
    finalizedBy: row.finalizedBy,
    finalizedAt: row.finalizedAt,
    isPublished: row.isPublished,
    publishedBy: row.publishedBy,
    publishedAt: row.publishedAt,
  });
}
@Injectable()
export class FinalResultService {
  constructor(
    private readonly repo: FinalResultRepository,
    private readonly sources: FinalResultSources,
    private readonly review: ProposalReviewValidator,
    private readonly roles: GuidanceValidator,
    private readonly config: ConfigService,
  ) {}
  private has(u: ReviewPrincipal, role: string, action: string) {
    return this.roles.role(u, role, "defense-result", action);
  }
  private principal = async (s: FinalResultSession, actor: string) =>
    this.review.principal(await s.principal(actor));
  private async access(
    s: FinalResultSession,
    actor: string,
    termId: string,
    memberId: string,
  ) {
    const u = await this.principal(s, actor),
      member = await s.member(memberId),
      owner = await s.memberProposal(memberId),
      p = owner.proposals.length === 1 ? owner.proposals[0] : null;
    if (
      !member ||
      member.termId !== termId ||
      !member.student.isActive ||
      !p ||
      p.termId !== termId ||
      p.studentId !== member.studentId ||
      this.review.ownership(p).termStudentId !== memberId
    )
      return missing();
    const department =
      p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
        ?.departmentId;
    if (this.has(u, "FACULTY", "read") && department) {
      const grants = await s.grants(actor, termId);
      if (
        grants.some(
          (g) =>
            g.termId === termId &&
            (g.allDepartments ||
              g.pr2bGrantDepartmentGrantId.some(
                (d) => d.departmentId === department,
              )),
        )
      )
        return { u, member, p, role: "FACULTY" as const };
    }
    if (
      u.lecturer?.isActive &&
      this.has(u, "LECTURER", "read") &&
      (await s.ccReady())
    ) {
      if (
        (await s.ccList(termId)).some(
          (c) =>
            c.studentAssignments.some(
              (a) =>
                a.termStudentId === memberId &&
                a.proposalId === p.id &&
                a.state === "ACTIVE",
            ) && c.members.some((m) => m.lecturerId === u.lecturer!.id),
        )
      )
        return { u, member, p, role: "LECTURER" as const };
    }
    if (
      u.student?.isActive &&
      u.student.id === member.studentId &&
      this.has(u, "STUDENT", "read") &&
      this.has(u, "STUDENT", "read-own")
    )
      return { u, member, p, role: "STUDENT" as const };
    return missing();
  }
  async options(actor: string) {
    return this.repo.read(async (s) => {
      const u = await this.principal(s, actor),
        ids = new Set<string>();
      if (
        !["FACULTY", "LECTURER", "STUDENT"].some((r) => this.has(u, r, "read"))
      )
        groupError(403, "AUTH_004", "Thiếu quyền xem kết quả.");
      if (this.has(u, "FACULTY", "read"))
        for (const g of await s.grants(actor)) ids.add(g.termId);
      if (
        u.student?.isActive &&
        this.has(u, "STUDENT", "read") &&
        this.has(u, "STUDENT", "read-own")
      )
        for (const t of await s.studentTerms(u.student.id)) ids.add(t.termId);
      if (
        u.lecturer?.isActive &&
        this.has(u, "LECTURER", "read") &&
        (await s.ccReady())
      )
        for (const t of await s.cgTermIds(u.lecturer.id))
          ids.add(t.committee.termId);
      const terms = await s.terms({ id: { in: [...ids] } }),
        committees: {
          id: string;
          termId: string;
          code: string | null;
          name: string;
        }[] = [];
      if (await s.ccReady())
        for (const termId of ids)
          for (const row of await s.ccList(termId)) {
            let visible = !!(
              u.lecturer?.isActive &&
              this.has(u, "LECTURER", "read") &&
              row.members.some((m) => m.lecturerId === u.lecturer!.id)
            );
            if (this.has(u, "FACULTY", "read"))
              visible ||= (await s.grants(actor, termId)).some(
                (g) =>
                  g.termId === termId &&
                  (g.allDepartments ||
                    g.pr2bGrantDepartmentGrantId.some(
                      (d) => d.departmentId === row.departmentId,
                    )),
              );
            if (visible)
              committees.push({
                id: row.id,
                termId,
                code: row.code,
                name: row.name,
              });
          }
      return { terms, committees };
    });
  }
  private async inspect(
    s: FinalResultSession,
    actor: string,
    termId: string,
    memberId: string,
  ) {
    const a = await this.access(s, actor, termId, memberId),
      ready = await s.frReady(),
      row = ready ? await s.frRow(a.p.id) : null,
      data = await this.sources.collect(s, termId, memberId, a.p.id),
      events = row ? await s.frEvents(row.id) : [];
    const raw = finalResultContext(row?.context);
    let ctx: Context | null = null;
    if (
      row &&
      raw?.kind === "UC24" &&
      raw.termId === termId &&
      raw.termStudentId === memberId &&
      raw.proposalId === a.p.id &&
      Array.isArray(raw.confirmations) &&
      reviewHash(raw.evidence) === raw.evidenceHash &&
      events.some(
        (e) =>
          (e.newValue as { snapshotHash?: string } | null)?.snapshotHash ===
          finalResultHash(row),
      )
    ) {
      try {
        if (
          reviewHash(calculateFinalResult(raw.policy, raw.evidence.sources)) ===
          reviewHash(raw.calculation)
        )
          ctx = raw;
      } catch {
        /* Legacy/corrupt policy or snapshot never becomes official. */
      }
    }
    const blockers = [...data.blockers];
    if (!ready) blockers.push("UC24_SCHEMA_REQUIRED");
    let confirmationsValid = true;
    if (ctx && data.committee && data.policy)
      for (const c of ctx.confirmations) {
        const u = await s.principal(c.actor),
          m = data.committee.members.find(
            (m) => m.lecturerId === c.lecturerId && m.role === c.role,
          );
        if (
          !u ||
          u.status !== "ACTIVE" ||
          !u.lecturer?.isActive ||
          u.lecturer.id !== c.lecturerId ||
          !m ||
          !this.has(u, "LECTURER", "read") ||
          !this.has(u, "LECTURER", "confirm") ||
          c.evidenceHash !== data.evidenceHash ||
          !data.policy.confirmation.roles.includes(c.role) ||
          !Number.isFinite(Date.parse(c.at)) ||
          Date.parse(c.at) > Date.now()
        )
          confirmationsValid = false;
      }
    if (
      ctx &&
      (new Set(ctx.confirmations.map((c) => c.role)).size !==
        ctx.confirmations.length ||
        (ctx.policy.confirmation.distinctActors &&
          new Set(ctx.confirmations.map((c) => c.actor)).size !==
            ctx.confirmations.length))
    )
      confirmationsValid = false;
    const rowValid =
      !!row &&
      (row.state === "CONFIRMING"
        ? !row.isLocked &&
          row.finalScore === null &&
          !row.isPublished &&
          !row.finalizedBy &&
          !row.finalizedAt
        : ["FINALIZED", "PUBLISHED"].includes(row.state) &&
          row.isLocked &&
          !!row.finalizedBy &&
          !!row.finalizedAt &&
          row.finalizedAt <= new Date() &&
          row.finalScore?.toString() === ctx?.calculation.finalScore &&
          row.isPassed === ctx?.calculation.isPassed &&
          (row.state === "PUBLISHED"
            ? row.isPublished &&
              !!row.publishedBy &&
              !!row.publishedAt &&
              row.publishedAt <= new Date()
            : !row.isPublished && !row.publishedAt && !row.publishedBy));
    const current =
      !!ctx &&
      rowValid &&
      !blockers.length &&
      ctx.evidenceHash === data.evidenceHash &&
      reviewHash(ctx.policy) === data.policyHash &&
      confirmationsValid;
    const confirmed =
      !!data.policy &&
      data.policy.confirmation.roles.every(
        (role) => !!ctx?.confirmations.some((c) => c.role === role),
      ) &&
      confirmationsValid;
    const legacy = !!(row && !ctx) || (!ready && !!(await s.frLegacy(a.p.id)));
    const state: FinalResultView["state"] = legacy
      ? "LEGACY_UNVERIFIED"
      : row && !current
        ? "STALE"
        : row?.state === "PUBLISHED"
          ? "PUBLISHED"
          : row?.state === "FINALIZED"
            ? "FINALIZED"
            : ctx
              ? confirmed
                ? "CONFIRMED"
                : "AWAITING_CONFIRMATION"
              : data.calculation
                ? "READY"
                : "INCOMPLETE";
    if (legacy) blockers.push("LEGACY_RESULT_UNVERIFIED");
    if (row && !legacy && !current) blockers.push("RESULT_SOURCE_CHANGED");
    if (!confirmationsValid) blockers.push("CONFIRMATION_NOT_CURRENT");
    const term = await s.windowTerm(termId),
      window = term ? operationWindow(term, "DEFENSE") : null,
      common = [...blockers];
    if (!window?.canWrite) common.push("DEFENSE_PHASE_CLOSED");
    if (this.config.get("UC24_WRITES_ENABLED", "false") !== "true")
      common.push("UC24_NOT_ENABLED");
    const member = data.committee?.members.find(
        (m) => m.lecturerId === a.u.lecturer?.id,
      ),
      actions = {
        confirm: [...common],
        finalize: [...common],
        publish: [...common],
      };
    if (
      !a.u.lecturer?.isActive ||
      !this.has(a.u, "LECTURER", "read") ||
      !this.has(a.u, "LECTURER", "confirm") ||
      !member ||
      !data.policy?.confirmation.roles.includes(member.role)
    )
      actions.confirm.push("COMMITTEE_CONFIRM_PERMISSION_REQUIRED");
    if (member && ctx?.confirmations.some((c) => c.role === member.role))
      actions.confirm.push("ROLE_ALREADY_CONFIRMED");
    if (row?.isLocked) actions.confirm.push("RESULT_IMMUTABLE");
    for (const action of ["finalize", "publish"] as const)
      if (a.role !== "FACULTY" || !this.has(a.u, "FACULTY", action))
        actions[action].push("FACULTY_PERMISSION_REQUIRED");
    if (!confirmed) {
      actions.finalize.push("COMMITTEE_CONFIRMATION_REQUIRED");
      actions.publish.push("COMMITTEE_CONFIRMATION_REQUIRED");
    }
    if (row?.isLocked) actions.finalize.push("RESULT_IMMUTABLE");
    if (row?.state !== "FINALIZED" || !row.isLocked || !current)
      actions.publish.push("FINALIZED_CURRENT_RESULT_REQUIRED");
    if (data.policy) {
      const p = data.policy,
        at = Date.now();
      if (
        at < Date.parse(p.finalizeWindow.notBefore) ||
        at >= Date.parse(p.finalizeWindow.before)
      ) {
        actions.confirm.push("FINALIZATION_WINDOW_CLOSED");
        actions.finalize.push("FINALIZATION_WINDOW_CLOSED");
      }
      if (
        at < Date.parse(p.publication.notBefore) ||
        at >= Date.parse(p.publication.before)
      )
        actions.publish.push("PUBLICATION_WINDOW_CLOSED");
      if (
        p.separation.finalizerNotConfirmer &&
        ctx?.confirmations.some((c) => c.actor === actor)
      )
        actions.finalize.push("SEPARATION_OF_DUTIES_REQUIRED");
      if (p.separation.publisherNotFinalizer && row?.finalizedBy === actor)
        actions.publish.push("SEPARATION_OF_DUTIES_REQUIRED");
    }
    const scoreRead = this.has(a.u, a.role, "components-read"),
      historyRead = this.has(a.u, a.role, "history-read");
    const visibleSourceIds = new Set(
      [...data.sources, ...(raw?.evidence.sources ?? [])].map(
        (source) => source.lecturerId,
      ),
    );
    const lecturerNames =
      scoreRead && a.role !== "STUDENT" && (await s.ccReady())
        ? Object.fromEntries(
            (await s.ccLecturers(termId))
              .filter((l) => visibleSourceIds.has(l.id))
              .map((l) => [l.id, l.fullName]),
          )
        : {};
    const view: FinalResultView = {
      termId,
      termStudentId: memberId,
      proposalId: a.p.id,
      studentCode: a.member.student.studentCode,
      studentName: a.member.student.fullName,
      title: a.p.topic.title,
      committeeId: data.committee?.committeeId ?? null,
      committeeCode: data.committee?.code ?? null,
      schedule: data.schedule,
      revision: row?.revision ?? 0,
      state,
      policy: data.policy,
      policyHash: data.policyHash,
      evidenceHash: data.evidenceHash,
      sources: scoreRead ? data.sources : [],
      calculation: scoreRead ? data.calculation : null,
      savedCalculation: scoreRead ? (ctx?.calculation ?? null) : null,
      savedPolicy: scoreRead ? (ctx?.policy ?? null) : null,
      savedSources: scoreRead && ctx ? (raw?.evidence.sources ?? []) : [],
      lecturerNames,
      requiredCount: data.requiredCount,
      validCount: data.sources.length,
      missingCount:
        data.requiredCount === null
          ? null
          : Math.max(0, data.requiredCount - data.sources.length),
      confirmations:
        ctx?.confirmations.map(({ reason: _reason, ...c }) => ({
          ...c,
          reason: null,
        })) ?? [],
      finalizedBy: row?.finalizedBy ?? null,
      finalizedAt: row?.finalizedAt?.toISOString() ?? null,
      publishedBy: row?.publishedBy ?? null,
      publishedAt: row?.publishedAt?.toISOString() ?? null,
      history: historyRead
        ? events.map((e) => ({
            action: e.action,
            actor: e.userId,
            at: e.createdAt.toISOString(),
            revision: (e.newValue as { revision: number }).revision,
          }))
        : [],
      blockers: [...new Set(blockers)],
      actions,
      visibility: "INTERNAL",
    };
    if (a.role === "STUDENT") {
      const released =
          state === "PUBLISHED" &&
          current &&
          data.policy?.publication.studentFinal &&
          this.has(a.u, "STUDENT", "final-read"),
        componentRelease =
          released && data.policy?.publication.studentComponents && scoreRead;
      const safeCalculation =
        released && ctx
          ? {
              ...ctx.calculation,
              components: componentRelease ? ctx.calculation.components : {},
              committeeScore: componentRelease
                ? ctx.calculation.committeeScore
                : null,
              reviewerScore: componentRelease
                ? ctx.calculation.reviewerScore
                : null,
            }
          : null;
      Object.assign(view, {
        committeeId: null,
        committeeCode: null,
        schedule: null,
        revision: 0,
        state: released
          ? "PUBLISHED"
          : state === "STALE" && row?.isPublished
            ? "STALE"
            : "INCOMPLETE",
        policy: null,
        policyHash: reviewHash(null),
        evidenceHash: reviewHash(null),
        sources: [],
        calculation: safeCalculation,
        savedCalculation: null,
        savedPolicy: null,
        savedSources: [],
        lecturerNames: {},
        requiredCount: null,
        validCount: 0,
        missingCount: null,
        confirmations: [],
        finalizedBy: null,
        finalizedAt: null,
        publishedBy: null,
        publishedAt: released
          ? (row?.publishedAt?.toISOString() ?? null)
          : null,
        history: [],
        blockers: released ? [] : ["RESULT_NOT_RELEASED"],
        actions: {
          confirm: ["NOT_PERMITTED"],
          finalize: ["NOT_PERMITTED"],
          publish: ["NOT_PERMITTED"],
        },
        visibility: "STUDENT",
      });
    }
    return { a, row, ctx, data, view, current, confirmed, actions };
  }
  detail(actor: string, memberId: string, termId: string) {
    return this.repo.read(
      async (s) => (await this.inspect(s, actor, termId, memberId)).view,
    );
  }
  preview(actor: string, memberId: string, termId: string) {
    return this.detail(actor, memberId, termId);
  }
  list(actor: string, q: FinalResultQuery) {
    return this.repo.read(async (s) => {
      const u = await this.principal(s, actor);
      if (
        !["FACULTY", "LECTURER", "STUDENT"].some((r) => this.has(u, r, "read"))
      )
        groupError(403, "AUTH_004", "Thiếu quyền xem kết quả.");
      const items: FinalResultView[] = [];
      for (const m of await s.members(q.termId)) {
        try {
          const { view } = await this.inspect(s, actor, q.termId, m.id);
          if (
            (q.committeeId && view.committeeId !== q.committeeId) ||
            (q.state && view.state !== q.state) ||
            (q.search &&
              ![view.studentCode, view.studentName, view.title].some((v) =>
                v
                  .normalize("NFC")
                  .toLocaleLowerCase("vi")
                  .includes(q.search.normalize("NFC").toLocaleLowerCase("vi")),
              ))
          )
            continue;
          items.push(view);
        } catch (e) {
          if (e instanceof HttpException && e.getStatus() === 404) continue;
          throw e;
        }
      }
      items.sort((a, b) => a.studentCode.localeCompare(b.studentCode));
      return {
        items: items.slice((q.page - 1) * q.limit, q.page * q.limit),
        total: items.length,
        page: q.page,
        limit: q.limit,
      };
    });
  }
  command(
    actor: string,
    memberId: string,
    input: FinalResultCommand,
    key: string,
    action: "confirm" | "finalize" | "publish",
  ) {
    const b = FinalResultCommandSchema.parse(input);
    if (!key || !/^[\w.-]{1,200}$/.test(key))
      groupError(400, "COMMON_003", "Cần Idempotency-Key hợp lệ.");
    return this.repo.write(async (s) => {
      const initial = await this.access(s, actor, b.termId, memberId);
      if (initial.role === "STUDENT")
        groupError(403, "AUTH_004", "Không có quyền ghi kết quả.");
      if (!(await s.frReady()) || !(await s.cgReady()))
        fail("UC24_SCHEMA_REQUIRED");
      await s.frLock(b.termId, initial.p.id);
      const d = await this.inspect(s, actor, b.termId, memberId),
        route = `/defense-results/${memberId}/${action}`,
        hash = reviewHash(b),
        replay = await s.replay(actor, route, key);
      // Replays still authorize, validate source/window/flag; only their own completed transition is exempt.
      const exempt =
        action === "confirm"
          ? ["ROLE_ALREADY_CONFIRMED", "RESULT_IMMUTABLE"]
          : action === "finalize"
            ? ["RESULT_IMMUTABLE"]
            : ["FINALIZED_CURRENT_RESULT_REQUIRED"];
      const gates = d.actions[action].filter((x) => !exempt.includes(x));
      if (
        gates.length ||
        !d.data.policy ||
        !d.data.calculation ||
        !d.data.committee
      )
        fail("RESULT_BLOCKED", gates.join("; "));
      if (replay) {
        if (replay.payloadHash !== hash) fail("IDEMPOTENCY_CONFLICT");
        if (!d.current) fail("RESULT_SOURCE_CHANGED");
        return replay.result;
      }
      if (d.actions[action].length)
        fail("RESULT_BLOCKED", d.actions[action].join("; "));
      if (b.expectedRevision !== (d.row?.revision ?? 0))
        fail("REVISION_CONFLICT");
      if (
        b.policyHash !== d.data.policyHash ||
        b.evidenceHash !== d.data.evidenceHash
      )
        fail("RESULT_SOURCE_CHANGED");
      const policy = d.data.policy,
        now = new Date(),
        confirmations = [...(d.ctx?.confirmations ?? [])];
      if (action === "confirm") {
        const member = d.data.committee.members.find(
          (m) => m.lecturerId === d.a.u.lecturer?.id,
        )!;
        if (policy.confirmation.reasonRequired && !b.reason)
          fail("CONFIRMATION_REASON_REQUIRED");
        if (
          policy.confirmation.distinctActors &&
          confirmations.some((c) => c.actor === actor)
        )
          fail("DISTINCT_CONFIRMERS_REQUIRED");
        confirmations.push({
          actor,
          lecturerId: member.lecturerId,
          role: member.role,
          at: now.toISOString(),
          evidenceHash: d.data.evidenceHash,
          reason: b.reason ?? null,
        });
      }
      const ctx: Context =
        action === "publish"
          ? d.ctx!
          : {
              kind: "UC24",
              termId: b.termId,
              termStudentId: memberId,
              proposalId: d.a.p.id,
              evidenceHash: d.data.evidenceHash,
              evidence: d.data.evidence,
              policy,
              calculation: d.data.calculation,
              confirmations,
            };
      const saved = await s.frSave(d.a.p.id, b.expectedRevision, {
        id: d.row?.id ?? randomUUID(),
        proposalId: d.a.p.id,
        revision: b.expectedRevision + 1,
        state:
          action === "confirm"
            ? "CONFIRMING"
            : action === "finalize"
              ? "FINALIZED"
              : "PUBLISHED",
        context: committeeJson(ctx),
        finalScore: action === "confirm" ? null : ctx.calculation.finalScore,
        isPassed: action === "confirm" ? null : ctx.calculation.isPassed,
        isLocked: action !== "confirm",
        finalizedBy:
          action === "finalize" ? actor : (d.row?.finalizedBy ?? null),
        finalizedAt: action === "finalize" ? now : (d.row?.finalizedAt ?? null),
        isPublished: action === "publish",
        publishedBy: action === "publish" ? actor : null,
        publishedAt: action === "publish" ? now : null,
      });
      await s.frEvent(
        actor,
        saved.id,
        `RESULT_${action.toUpperCase()}`,
        d.row
          ? { revision: d.row.revision, snapshotHash: finalResultHash(d.row) }
          : null,
        {
          revision: saved.revision,
          snapshotHash: finalResultHash(saved),
          context: ctx,
          finalizedBy: saved.finalizedBy,
          finalizedAt: saved.finalizedAt,
          publishedBy: saved.publishedBy,
          publishedAt: saved.publishedAt,
        },
      );
      const result = {
        finalResultId: saved.id,
        revision: saved.revision,
        state: saved.state,
      };
      await s.remember(actor, route, key, hash, committeeJson(result));
      return result;
    });
  }
  // UC25 must call in its own consistent transaction; no preview/legacy/stale return.
  async effectiveInSession(
    s: FinalResultSession,
    actor: string,
    termId: string,
    memberId: string,
    revision: number,
  ): Promise<EffectiveFinalResult> {
    const d = await this.inspect(s, actor, termId, memberId);
    if (
      d.a.role !== "FACULTY" ||
      !this.has(d.a.u, "FACULTY", "components-read")
    )
      groupError(403, "AUTH_004", "Thiếu quyền đọc kết quả chính thức.");
    if (
      !d.current ||
      !d.confirmed ||
      !d.row?.isLocked ||
      !["FINALIZED", "PUBLISHED"].includes(d.row.state) ||
      !d.row.finalizedBy ||
      !d.row.finalizedAt ||
      !d.ctx ||
      !d.data.committee
    )
      fail("RESULT_NOT_CURRENT");
    this.review.revision(d.row.revision, revision);
    return {
      termId,
      termStudentId: memberId,
      proposalId: d.a.p.id,
      committeeId: d.data.committee.committeeId,
      finalResultId: d.row.id,
      revision,
      committee: d.data.committee,
      sources: d.data.sources,
      policy: d.ctx.policy,
      policyHash: reviewHash(d.ctx.policy),
      calculation: d.ctx.calculation,
      evidenceHash: d.ctx.evidenceHash,
      confirmations: d.ctx.confirmations,
      finalizedBy: d.row.finalizedBy,
      finalizedAt: d.row.finalizedAt.toISOString(),
      publishedBy: d.row.publishedBy,
      publishedAt: d.row.publishedAt?.toISOString() ?? null,
      effectiveStatus: "CURRENT",
      publicationStatus: d.row.state === "PUBLISHED" ? "PUBLISHED" : "WITHHELD",
    };
  }
}
