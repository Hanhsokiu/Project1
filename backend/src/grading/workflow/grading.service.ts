import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  gradingDraftSchema,
  gradingKindSchema,
  gradingPolicyInputSchema,
  gradingPolicySchema,
  gradingSaveSchema,
  gradingPdfIdentitySchema,
  reviewerRubric,
  workflowCommandSchema,
  type GradeContext,
  type GradeView,
  type GradingCommand,
  type GradingKind,
  type GradingPolicy,
  type GradingPolicyInput,
  type GradingSave,
  type AggregateView,
  type PublishedGrade,
} from "@doan/shared";
import { AuditService } from "../../common/audit/audit.service";
import { academicTermScope } from "../../common/security/academic-term-scope.policy";
import type { ReviewPrincipal } from "../../topic/proposal-reviews/proposal-review.repository";
import { GradingRepository, type GradingSession } from "./grading.repository";
import { GradingSourceReader } from "./grading-source.reader";
import {
  AdvisorGradeReader,
  CouncilResultConfirmationReader,
} from "./advisor-grade.port";
import {
  assertOpen,
  calculateGrades,
  gradingError,
  gradingErrorCode,
  hashJson,
  resultSnapshotSchema,
  scoreDraft,
  sheetSnapshotSchema,
  type SheetSnapshot,
  type ResultSnapshot,
} from "./grading.policy";
import {
  verifyAdvisorGrade,
  verifyCouncilConfirmation,
} from "./grading-evidence";
import { defenseListSnapshotV2Schema } from "../../common/uc18-finalization/defense-list-snapshot";
import {
  readGradingParameters,
  verifyGradingParameters,
  parametersMatchPolicy,
} from "./grading-parameters";

type Loaded = Awaited<ReturnType<GradingSourceReader["read"]>>;
type SheetRow = Awaited<ReturnType<GradingSession["sheet"]>>;
type PolicyRow = Awaited<ReturnType<GradingSession["policyRecord"]>>;
type ResultRow = Awaited<ReturnType<GradingSession["result"]>>;
type Result = { changed: boolean; revision: number; expectedContext: string };
const asJson = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export function hasGradingPermission(
  user: ReviewPrincipal,
  action: string,
  resource = "grading",
) {
  return user.userRoles.some((r) =>
    r.role.rolePermissions.some(
      (p) =>
        p.permission.resource === resource && p.permission.action === action,
    ),
  );
}
export function readGradingPolicy(row: PolicyRow): GradingPolicy | null {
  if (
    !row?.current ||
    row.revision <= 0 ||
    row.current.id !== row.currentRevisionId ||
    row.current.termId !== row.termId ||
    row.current.revision !== row.revision
  )
    return null;
  const c = row.current,
    p = gradingPolicySchema.safeParse(c.config);
  if (
    !p.success ||
    hashJson({
      termId: c.termId,
      revision: c.revision,
      config: c.config,
      recordedAt: c.recordedAt.toISOString(),
      recordedByUserId: c.recordedByUserId,
    }) !== c.contentHash
  )
    return null;
  return p.data;
}
export function readSheet(row: SheetRow): SheetSnapshot | null {
  if (!row?.current || row.current.id !== row.currentRevisionId) return null;
  if (row.current.revision !== row.revision || row.current.state !== row.state)
    return null;
  return readSheetRevision(row, row.current);
}
type SheetOwner = Pick<
  NonNullable<SheetRow>,
  "id" | "termId" | "proposalId" | "kind" | "scorerUserId"
>;
type SheetRevision = NonNullable<NonNullable<SheetRow>["current"]>;
export function readSheetRevision(
  row: SheetOwner,
  h: SheetRevision,
): SheetSnapshot | null {
  const p = sheetSnapshotSchema.safeParse(h.snapshot);
  if (!p.success || hashJson(h.snapshot) !== h.contentHash) return null;
  const a = p.data;
  if (
    a.sheetId !== row.id ||
    a.termId !== row.termId ||
    a.proposalId !== row.proposalId ||
    a.kind !== row.kind ||
    a.revision !== h.revision ||
    a.state !== h.state ||
    h.sheetId !== row.id ||
    h.termId !== row.termId ||
    a.actorUserId !== row.scorerUserId ||
    a.actorUserId !== h.recordedByUserId ||
    a.recordedAt !== h.recordedAt.toISOString()
  )
    return null;
  const source = a.kind === "REVIEWER" ? a.source.reviewer : a.source.schedule;
  if (
    !source ||
    source.id !== h.sourceArtifactId ||
    source.revision !== h.sourceRevision ||
    h.sourceStage !== (a.kind === "REVIEWER" ? "REVIEWERS" : "SCHEDULE")
  )
    return null;
  try {
    if (
      scoreDraft(a.draft, a.rubric, a.state === "SEALED") !== a.total ||
      (a.state === "SEALED" &&
        a.kind === "REVIEWER" &&
        a.draft.questions.length < 2)
    )
      return null;
  } catch {
    return null;
  }
  return a;
}
export function readResult(row: ResultRow): ResultSnapshot | null {
  const h = row?.current;
  if (!row || !h || row.currentRevisionId !== h.id) return null;
  const p = resultSnapshotSchema.safeParse(h.snapshot);
  if (!p.success || hashJson(h.snapshot) !== h.contentHash) return null;
  const a = p.data;
  const policy = h.policy
    ? readGradingPolicy({
        termId: row.termId,
        revision: a.policyRevision,
        currentRevisionId: h.policy.id,
        current: h.policy,
      })
    : null;
  if (
    policy?.calculation.state !== "CONFIRMED" ||
    hashJson(policy.calculation.policy) !== hashJson(a.policy) ||
    h.policy.contentHash !== a.policyHash
  )
    return null;
  if (
    !parametersMatchPolicy(
      verifyGradingParameters(a.parameters, a.termId, new Date(a.recordedAt)),
      a.policy,
    )
  )
    return null;
  const totals = calculateGrades(
    a.policy,
    a.advisor.score,
    a.gradeValues.reviewer,
    a.gradeValues.committee,
  );
  if (
    totals.process !== a.process ||
    totals.committee !== a.committeeScore ||
    totals.final !== a.final ||
    totals.passed !== a.passed
  )
    return null;
  return a.termId === row.termId &&
    a.termId === h.termId &&
    a.proposalId === row.proposalId &&
    a.proposalId === h.proposalId &&
    a.revision === row.revision &&
    a.revision === h.revision &&
    a.state === row.state &&
    a.state === h.state &&
    a.policyRevision === h.policyRevision &&
    a.recordedAt === h.recordedAt.toISOString() &&
    a.actorUserId === h.recordedByUserId
    ? a
    : null;
}
@Injectable()
export class GradingService {
  constructor(
    @Inject(GradingRepository) readonly repo: GradingRepository,
    @Inject(GradingSourceReader) readonly sources: GradingSourceReader,
    @Inject(AdvisorGradeReader) readonly advisor: AdvisorGradeReader,
    @Inject(CouncilResultConfirmationReader)
    readonly council: CouncilResultConfirmationReader,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}
  async actor(
    s: GradingSession,
    id: string,
    action: string,
    resource = "grading",
  ) {
    const u = await s.principal(id);
    if (
      !u ||
      u.id !== id ||
      u.status !== "ACTIVE" ||
      u.mustChangePassword ||
      !hasGradingPermission(u, action, resource)
    )
      gradingError(
        403,
        "GRADING_FORBIDDEN",
        "Cần tài khoản hoạt động và permission phù hợp; role không thay cho quyền.",
      );
    return u;
  }
  async faculty(
    s: GradingSession,
    id: string,
    termId: string,
    action: string,
    departmentId?: string | null,
    all = false,
  ) {
    const u = await this.actor(s, id, action),
      grant = academicTermScope(await s.grants(id, termId), id, termId);
    if (all ? !grant.allDepartments : !grant.contains(departmentId))
      gradingError(
        403,
        "GRADING_GRANT_REQUIRED",
        "Cần AcademicTermGrant đúng đợt và phạm vi hồ sơ.",
      );
    return u;
  }
  /** Verify an immutable version against its own policy/artifact, not today's pointers. */
  async verifiedSheet(s: GradingSession, owner: SheetOwner, h: SheetRevision) {
    const a = readSheetRevision(owner, h);
    if (!a) return null;
    const p = await s.policyRevision(a.termId, a.policyRevision);
    const policy = p
      ? readGradingPolicy({
          termId: a.termId,
          revision: a.policyRevision,
          currentRevisionId: p.id,
          current: p,
        })
      : null;
    const artifactRow = await s.artifact(h.sourceArtifactId);
    const artifact = this.sources.artifact(artifactRow ?? undefined);
    const ref = a.kind === "REVIEWER" ? a.source.reviewer : a.source.schedule;
    if (
      !policy ||
      hashJson(a.rubric) !==
        hashJson(
          a.kind === "REVIEWER" ? reviewerRubric : policy.committeeRubric,
        ) ||
      !artifact ||
      !artifactRow ||
      !ref ||
      artifact.termId !== a.termId ||
      artifact.stage !== h.sourceStage ||
      artifact.workflowRevision !== h.sourceRevision ||
      artifactRow.contentHash !== ref.hash ||
      artifactRow.id !== ref.id ||
      artifactRow.sealedAt > h.recordedAt ||
      (artifact.upstream &&
        hashJson({
          id: artifact.upstream.id,
          revision: artifact.upstream.revision,
          hash: artifact.upstream.hash,
        }) !==
          hashJson(
            a.kind === "REVIEWER" ? a.source.committee : a.source.reviewer,
          )) ||
      hashJson(artifact.source) !== hashJson(a.source.uc18) ||
      !artifact.students.some(
        (x) =>
          x.proposalId === a.proposalId &&
          x.studentId === a.source.studentId &&
          x.studentUserId === a.source.studentUserId &&
          x.studentName === a.source.studentName &&
          x.title === a.source.title &&
          x.departmentId === a.source.departmentId &&
          x.advisorId === a.source.advisorId &&
          x.advisorUserId === a.source.advisorUserId,
      )
    )
      return null;
    if (
      a.kind === "REVIEWER"
        ? !artifact.reviewers.some(
            (x) =>
              x.proposalId === a.proposalId &&
              x.reviewerIds.includes(a.source.scorerLecturerId),
          )
        : !artifact.committees.some(
            (c) =>
              c.proposalIds.includes(a.proposalId) &&
              c.members.some(
                (m) =>
                  m.lecturerId === a.source.scorerLecturerId &&
                  m.role === a.source.committeeRole,
              ),
          )
    )
      return null;
    const root = await s.readFinalization(a.source.uc18.id);
    const parsedRoot = defenseListSnapshotV2Schema.safeParse(root?.snapshot);
    if (
      !root ||
      !parsedRoot.success ||
      root.snapshotSchemaVersion !== 2 ||
      root.termId !== a.termId ||
      root.listRevision !== a.source.uc18.revision ||
      root.contentHash !== a.source.uc18.hash ||
      hashJson(root.snapshot) !== root.contentHash
    )
      return null;
    const admitted = parsedRoot.data.students.find(
      (x) => x.proposalId === a.proposalId,
    );
    const academic = parsedRoot.data.academicEvidence.find(
      (x) => x.studentId === a.source.studentId,
    );
    if (
      !admitted?.admitted ||
      hashJson(admitted.pdf) !== hashJson(a.source.pdf) ||
      hashJson(academic?.assignment) !== hashJson(a.source.assignment) ||
      academic?.advisorUserId !== a.source.advisorUserId
    )
      return null;
    return a;
  }
  /** Validate stored input versions, not mutable current grades. Publication remains historical. */
  async verifiedResult(s: GradingSession, row: ResultRow) {
    const a = readResult(row);
    if (!a) return null;
    const refs = [a.reviewer, ...a.committee];
    const versions = await s.sheetRevisions(refs.map((r) => r.id));
    if (versions.length !== refs.length) return null;
    const grades: SheetSnapshot[] = [];
    for (const [index, ref] of refs.entries()) {
      const h = versions.find((h) => h.id === ref.id);
      if (
        !h ||
        h.revision !== ref.revision ||
        h.contentHash !== ref.hash ||
        h.termId !== a.termId ||
        h.recordedAt > new Date(a.recordedAt)
      )
        return null;
      const grade = await this.verifiedSheet(s, h.sheet, h);
      if (
        !grade ||
        grade.proposalId !== a.proposalId ||
        grade.state !== "SEALED" ||
        grade.kind !== (index === 0 ? "REVIEWER" : "COMMITTEE") ||
        grade.total !==
          (index === 0
            ? a.gradeValues.reviewer
            : a.gradeValues.committee[index - 1])
      )
        return null;
      grades.push(grade);
    }
    const source = grades[0].source,
      schedule = grades[1]?.source.schedule;
    const scheduleRow = schedule ? await s.artifact(schedule.id) : null;
    const scheduleSnapshot = this.sources.artifact(scheduleRow ?? undefined);
    const committee = scheduleSnapshot?.committees.find((c) =>
      c.proposalIds.includes(a.proposalId),
    );
    if (
      !committee ||
      a.policy.quorum !== "ALL_OFFICIAL_MEMBERS" ||
      hashJson(committee.members.map((m) => m.lecturerId).sort()) !==
        hashJson(
          grades
            .filter((g) => g.kind === "COMMITTEE")
            .map((g) => g.source.scorerLecturerId)
            .sort(),
        )
    )
      return null;
    if (
      !schedule ||
      grades.some(
        (g) =>
          hashJson(g.source.pdf) !== hashJson(source.pdf) ||
          hashJson(g.source.assignment) !== hashJson(source.assignment) ||
          hashJson(g.source.uc18) !== hashJson(source.uc18) ||
          hashJson(g.source.committee) !== hashJson(source.committee) ||
          hashJson(g.source.reviewer) !== hashJson(source.reviewer) ||
          (g.kind === "COMMITTEE" &&
            hashJson(g.source.schedule) !== hashJson(schedule)),
      ) ||
      new Set(grades.map((g) => `${g.kind}:${g.actorUserId}`)).size !==
        grades.length
    )
      return null;
    const advisor = verifyAdvisorGrade(
      a.advisor.evidence,
      a.termId,
      a.proposalId,
      new Date(a.recordedAt),
    );
    const council = verifyCouncilConfirmation(
      a.council.evidence,
      a.termId,
      a.proposalId,
      new Date(a.recordedAt),
      schedule,
      refs,
    );
    if (
      advisor.state !== "VERIFIED" ||
      council.state !== "VERIFIED" ||
      advisor.hash !== a.advisor.hash ||
      advisor.id !== a.advisor.id ||
      advisor.revision !== a.advisor.revision ||
      advisor.score !== a.advisor.score ||
      advisor.advisorUserId !== source.advisorUserId ||
      hashJson(advisor.assignment) !== hashJson(source.assignment) ||
      hashJson(advisor.pdf) !==
        hashJson({
          finalReportId: source.pdf.finalReportId,
          revision: source.pdf.revision,
          checksum: source.pdf.checksum,
        }) ||
      council.contentHash !== a.council.hash ||
      council.id !== a.council.id ||
      council.revision !== a.council.revision ||
      council.scheduleArtifactId !== a.council.scheduleArtifactId ||
      hashJson([...council.gradeRevisionIds].sort()) !==
        hashJson([...a.council.gradeRevisionIds].sort())
    )
      return null;
    return a;
  }
  private mutable(term: Loaded["term"]) {
    if (
      !term ||
      term.isLocked ||
      !["IN_PROGRESS", "DEFENDING"].includes(term.status)
    )
      gradingError(
        409,
        "GRADING_TERM_CLOSED",
        "Đợt không ở trạng thái cho phép ghi điểm.",
      );
  }
  private view(row: SheetRow, a: SheetSnapshot | null): GradeView {
    return {
      configured: !!row,
      revision: row?.revision ?? 0,
      state: !row ? "ABSENT" : !a ? "INVALID" : a.state,
      draft: a?.draft ?? null,
      total: a?.total ?? null,
      at: a?.recordedAt ?? null,
    };
  }
  private entryGate(c: Awaited<ReturnType<GradingService["entry"]>>, at: Date) {
    this.mutable(c.loaded.term);
    assertOpen(c.policy, c.kind, at);
    if (c.loaded.blockers.length || !c.loaded.snapshot || !c.rubric)
      gradingError(
        409,
        "GRADING_SOURCE_NOT_READY",
        "Thiếu nguồn/PDF/rubric hợp lệ; tải lại context.",
      );
    if (
      c.kind === "COMMITTEE" &&
      (c.loaded.term?.status !== "DEFENDING" ||
        !c.loaded.snapshot.slot ||
        at < new Date(c.loaded.snapshot.slot.startsAt) ||
        at >= new Date(c.loaded.snapshot.slot.endsAt))
    )
      gradingError(
        409,
        "GRADING_NOT_IN_DEFENSE_SESSION",
        "Chỉ nhập điểm trong buổi bảo vệ chính thức của hồ sơ.",
      );
  }
  private async entry(
    s: GradingSession,
    tx: Prisma.TransactionClient,
    userId: string,
    termId: string,
    proposalId: string,
    kind: GradingKind,
  ) {
    const actor = await this.actor(s, userId, "read");
    if (!actor.lecturer?.isActive || actor.lecturer.userId !== actor.id)
      gradingError(
        403,
        "GRADING_LECTURER_REQUIRED",
        "Cần giảng viên hoạt động có phân công chính thức.",
      );
    const loaded = await this.sources.read(
        s,
        tx,
        termId,
        proposalId,
        kind,
        actor.lecturer.id,
      ),
      policyRow = await s.policyRecord(termId),
      policy = readGradingPolicy(policyRow),
      row = await s.sheet(termId, proposalId, userId, kind),
      rubric =
        kind === "REVIEWER"
          ? [...reviewerRubric]
          : (policy?.committeeRubric ?? null);
    const verified =
      row?.current && readSheet(row)
        ? await this.verifiedSheet(s, row, row.current)
        : null;
    const expectedContext = hashJson({
      user: actor,
      loaded: loaded.fingerprint,
      policy: policyRow,
      sheet: row,
      kind,
      verified: !!verified,
    });
    return {
      actor,
      loaded,
      policyRow,
      policy,
      row,
      rubric,
      kind,
      expectedContext,
      verified,
    };
  }
  async context(
    userId: string,
    termId: string,
    proposalId: string,
    rawKind: string,
  ): Promise<GradeContext> {
    const kind = gradingKindSchema.parse(rawKind);
    return this.repo.transaction(false, async (s, tx) => {
      const c = await this.entry(s, tx, userId, termId, proposalId, kind),
        blockers = [...c.loaded.blockers],
        grade = this.view(c.row, c.verified);
      try {
        this.entryGate(c, await s.now());
      } catch (e) {
        blockers.push(gradingErrorCode(e, "GRADING_NOT_OPEN"));
      }
      if (!c.rubric) blockers.push("RUBRIC_NOT_CONFIGURED");
      if (grade.state === "INVALID") blockers.push("GRADE_LEGACY_OR_INVALID");
      const allowed =
        !blockers.length &&
        grade.state !== "SEALED" &&
        hasGradingPermission(c.actor, "write");
      return {
        termId,
        proposalId,
        kind,
        title: c.loaded.p.topic.title,
        studentName: c.loaded.p.student.fullName,
        expectedContext: c.expectedContext,
        expectedRevision: grade.revision,
        policyRevision: c.policyRow?.revision ?? 0,
        grade,
        rubric: c.rubric,
        blockers,
        canSave: allowed,
        canSeal: allowed && hasGradingPermission(c.actor, "seal"),
        window: c.policy?.windows[kind] ?? null,
        pdf:
          c.loaded.pdf.state === "READY" && c.loaded.pdf.snapshot
            ? {
                finalReportId: c.loaded.pdf.snapshot.finalReportId,
                revision: c.loaded.pdf.snapshot.revision,
                checksum: c.loaded.pdf.snapshot.checksum,
                originalName: c.loaded.pdf.snapshot.originalName,
              }
            : null,
        source: c.loaded.snapshot
          ? {
              uc18Id: c.loaded.snapshot.uc18.id,
              committeeId: c.loaded.snapshot.committee.id,
              reviewerId: c.loaded.snapshot.reviewer.id,
              scheduleId: c.loaded.snapshot.schedule?.id ?? null,
            }
          : null,
      };
    });
  }
  async inbox(userId: string, termId: string, kind: GradingKind) {
    return this.repo.transaction(false, async (s, tx) => {
      const actor = await this.actor(s, userId, "read");
      if (!actor.lecturer?.isActive)
        gradingError(
          403,
          "GRADING_LECTURER_REQUIRED",
          "Cần giảng viên hoạt động.",
        );
      const c = await this.sources.chain(s, tx, termId, kind === "COMMITTEE"),
        id = actor.lecturer.id;
      const ids =
        kind === "REVIEWER"
          ? c.reviewer.snapshot.reviewers
              .filter((r) => r.reviewerIds[0] === id)
              .map((r) => r.proposalId)
          : c.committee.snapshot.committees
              .filter((c) => c.members.some((m) => m.lecturerId === id))
              .flatMap((c) => c.proposalIds);
      const rows = await s.sheets(termId, undefined, userId);
      return {
        termId,
        kind,
        items: await Promise.all(
          c.reviewer.snapshot.students
            .filter((p) => ids.includes(p.proposalId) && p.advisorId !== id)
            .map(async (p) => {
              const row = rows.find(
                (r) =>
                  r.proposalId === p.proposalId &&
                  r.scorerUserId === userId &&
                  r.kind === kind,
              );
              return {
                proposalId: p.proposalId,
                studentName: p.studentName,
                title: p.title,
                state: this.view(
                  row ?? null,
                  row?.current && readSheet(row)
                    ? await this.verifiedSheet(s, row, row.current)
                    : null,
                ).state,
                revision: row?.revision ?? 0,
              };
            }),
        ),
        blockers: [],
      };
    });
  }
  async policy(userId: string, termId: string) {
    return this.repo.transaction(false, async (s) => {
      await this.faculty(s, userId, termId, "configure", null, true);
      const term = await s.term(termId);
      if (!term)
        gradingError(404, "GRADING_TERM_NOT_FOUND", "Không tìm thấy đợt.");
      const row = await s.policyRecord(termId),
        config = readGradingPolicy(row);
      return {
        termId,
        configured: !!config,
        revision: row?.revision ?? 0,
        config,
        expectedContext: hashJson({ term, policy: row }),
        needsApproval: [
          "QUORUM_AND_ROUNDING",
          "AUTHORITATIVE_ADVISOR_GRADE_SOURCE",
          "POST_SEAL_CORRECTIONS",
          "CHAIR_SECRETARY_CONFIRMATION_POLICY",
        ],
      };
    });
  }
  private async replay(
    s: GradingSession,
    userId: string,
    action: string,
    input: GradingCommand,
    current: string,
    method = "POST",
  ) {
    const old = await s.idempotency(userId, method, action, input.requestId);
    if (!old) return null;
    if (old.payloadHash !== hashJson(input) || old.expiresAt <= (await s.now()))
      gradingError(
        409,
        "GRADING_IDEMPOTENCY_CONFLICT",
        "RequestId đã dùng hoặc hết hạn.",
      );
    const result = old.result as {
      expectedContext?: string;
      revision?: number;
    } | null;
    if (
      !result ||
      result.expectedContext !== current ||
      !Number.isInteger(result.revision)
    )
      gradingError(
        409,
        "GRADING_CONTEXT_CHANGED",
        "Dữ liệu sau request đã thay đổi; hãy tải lại.",
      );
    return {
      changed: false,
      revision: result.revision!,
      expectedContext: current,
    };
  }
  private async remember(
    s: GradingSession,
    userId: string,
    action: string,
    input: GradingCommand,
    result: Result,
    method = "POST",
  ) {
    const now = await s.now();
    await s.rememberCommand({
      actorId: userId,
      method,
      route: action,
      key: input.requestId,
      payloadHash: hashJson(input),
      result: asJson(result),
      expiresAt: new Date(now.getTime() + 86400000),
    });
  }
  private expected(input: GradingCommand, revision: number, context: string) {
    if (
      revision !== input.expectedRevision ||
      context !== input.expectedContext
    )
      gradingError(
        409,
        "GRADING_CONTEXT_CHANGED",
        "Revision hoặc nguồn đã thay đổi; cần tải và xem lại dữ liệu.",
      );
  }
  async configure(userId: string, termId: string, raw: GradingPolicyInput) {
    const input = gradingPolicyInputSchema.parse(raw);
    return this.repo.transaction(true, async (s, tx) => {
      await this.faculty(s, userId, termId, "configure", null, true);
      await s.lockGrading(termId);
      await this.faculty(s, userId, termId, "configure", null, true);
      const term = await s.term(termId);
      this.mutable(term);
      const row = await s.policyRecord(termId),
        config = readGradingPolicy(row),
        current = hashJson({ term, policy: row });
      const action = `${termId}:GRADING_POLICY`,
        replay = await this.replay(s, userId, action, input, current, "PUT");
      if (replay) return replay;
      this.expected(input, row?.revision ?? 0, current);
      for (const w of Object.values(input.config.windows))
        if (
          new Date(w.opensAt) < term!.startDate ||
          new Date(w.closesAt) > term!.endDate
        )
          gradingError(
            422,
            "GRADING_WINDOW_OUTSIDE_TERM",
            "Mốc chấm phải nằm trong thời gian đợt.",
          );
      const sheets = await s.sheets(termId),
        results = await s.results(termId);
      if (
        (sheets.some((x) => x.state === "SEALED") || results.length) &&
        hashJson({
          rubric: config?.committeeRubric,
          calculation: config?.calculation,
        }) !==
          hashJson({
            rubric: input.config.committeeRubric,
            calculation: input.config.calculation,
          })
      )
        gradingError(
          409,
          "GRADING_POLICY_IN_USE",
          "Sau chốt chỉ được chỉnh cửa sổ; không thay rubric/công thức đang dùng.",
        );
      if (row && !config)
        gradingError(
          409,
          "GRADING_POLICY_INVALID",
          "Policy hiện hành không xác minh được.",
        );
      if (!row) await s.createPolicy(termId);
      const id = randomUUID(),
        revision = (row?.revision ?? 0) + 1,
        at = await s.now(),
        envelope = {
          termId,
          revision,
          config: input.config,
          recordedAt: at.toISOString(),
          recordedByUserId: userId,
        };
      await s.policyVersion({
        id,
        termId,
        revision,
        config: asJson(input.config),
        contentHash: hashJson(envelope),
        recordedAt: at,
        recordedByUserId: userId,
      });
      if ((await s.policyUpdate(termId, revision - 1, id)).count !== 1)
        gradingError(409, "GRADING_REVISION_CONFLICT", "Policy đã thay đổi.");
      await this.audit.log(
        {
          userId,
          resource: "grading-policy",
          resourceId: termId,
          action: "CONFIGURE",
          oldValue: { revision: revision - 1 },
          newValue: envelope,
        },
        tx,
      );
      const result = {
        changed: true,
        revision,
        expectedContext: hashJson({
          term: await s.term(termId),
          policy: await s.policyRecord(termId),
        }),
      };
      await this.remember(s, userId, action, input, result, "PUT");
      return result;
    });
  }
  async save(
    userId: string,
    termId: string,
    proposalId: string,
    kind: GradingKind,
    raw: GradingSave | GradingCommand,
    seal: boolean,
  ) {
    const input = seal
      ? workflowCommandSchema.parse(raw)
      : gradingSaveSchema.parse(raw);
    return this.repo.transaction(true, async (s, tx) => {
      await this.actor(s, userId, seal ? "seal" : "write");
      await s.lockGrading(termId);
      await this.actor(s, userId, "write");
      await this.actor(s, userId, seal ? "seal" : "write");
      const c = await this.entry(s, tx, userId, termId, proposalId, kind);
      this.entryGate(c, await s.now());
      const action = `${termId}:${proposalId}:${kind}:${seal ? "SEAL" : "SAVE"}`,
        method = seal ? "POST" : "PUT",
        replay = await this.replay(
          s,
          userId,
          action,
          input,
          c.expectedContext,
          method,
        );
      if (replay) return replay;
      this.expected(input, c.row?.revision ?? 0, c.expectedContext);
      if (c.row?.state === "SEALED")
        gradingError(
          409,
          "GRADING_SHEET_SEALED",
          "Phiếu đã chốt; chính sách sửa sau chốt đang NEEDS_APPROVAL.",
        );
      const previous = c.verified;
      if (c.row && !previous)
        gradingError(
          409,
          "GRADING_SHEET_INVALID",
          "Phiếu hiện hành không xác minh được.",
        );
      const draft = gradingDraftSchema.parse(
          seal ? previous?.draft : (input as GradingSave).draft,
        ),
        total = scoreDraft(draft, c.rubric!, seal);
      if (seal && kind === "REVIEWER" && draft.questions.length < 2)
        gradingError(
          422,
          "REVIEW_QUESTIONS_REQUIRED",
          "Phiếu phản biện cần ít nhất hai câu hỏi.",
        );
      if (
        seal &&
        previous &&
        (hashJson(previous.rubric) !== hashJson(c.rubric) ||
          hashJson(previous.source) !== hashJson(c.loaded.snapshot))
      )
        gradingError(
          409,
          "GRADING_DRAFT_SOURCE_CHANGED",
          "Phải xem và lưu lại draft theo nguồn/rubric mới trước khi chốt.",
        );
      const sheetId = c.row?.id ?? randomUUID();
      if (!c.row)
        await s.createSheet({
          id: sheetId,
          termId,
          proposalId,
          scorerUserId: userId,
          kind,
        });
      const revision = (c.row?.revision ?? 0) + 1,
        at = await s.now(),
        id = randomUUID(),
        state = seal ? "SEALED" : "DRAFT",
        source = c.loaded.snapshot!,
        snap = sheetSnapshotSchema.parse({
          schemaVersion: 1,
          sheetId,
          termId,
          proposalId,
          revision,
          state,
          kind,
          actorUserId: userId,
          recordedAt: at.toISOString(),
          policyRevision: c.policyRow!.revision,
          source,
          rubric: c.rubric,
          draft,
          total,
        }),
        artifact = kind === "REVIEWER" ? source.reviewer : source.schedule!;
      await s.sheetVersion({
        id,
        sheetId,
        termId,
        revision,
        state,
        snapshot: asJson(snap),
        contentHash: hashJson(snap),
        sourceArtifactId: artifact.id,
        sourceStage: kind === "REVIEWER" ? "REVIEWERS" : "SCHEDULE",
        sourceRevision: artifact.revision,
        recordedAt: at,
        recordedByUserId: userId,
      });
      if ((await s.sheetUpdate(sheetId, revision - 1, id, state)).count !== 1)
        gradingError(409, "GRADING_REVISION_CONFLICT", "Phiếu đã thay đổi.");
      await this.audit.log(
        {
          userId,
          resource: "grading-sheet",
          resourceId: sheetId,
          action: seal ? "SEAL" : "SAVE_DRAFT",
          oldValue: { revision: revision - 1 },
          newValue: { revision, state, contentHash: hashJson(snap) },
        },
        tx,
      );
      if (seal)
        await s.notifyRecipients(
          await s.gradingWatchers(termId, source.departmentId),
          termId,
          "Đã nhận phiếu điểm",
          `/grading/results?termId=${encodeURIComponent(termId)}`,
        ); // No student disclosure before publication.
      const latest = await this.entry(s, tx, userId, termId, proposalId, kind);
      await this.actor(s, userId, seal ? "seal" : "write");
      this.entryGate(latest, await s.now());
      if (
        latest.loaded.fingerprint !== c.loaded.fingerprint ||
        hashJson(latest.policyRow) !== hashJson(c.policyRow)
      )
        gradingError(
          409,
          "GRADING_CONTEXT_CHANGED",
          "Nguồn thay đổi trong transaction.",
        );
      const result = {
        changed: true,
        revision,
        expectedContext: latest.expectedContext,
      };
      await this.remember(s, userId, action, input, result, method);
      this.entryGate(latest, await s.now());
      return result;
    });
  }
  async history(
    userId: string,
    termId: string,
    proposalId: string,
    kind: GradingKind,
    after: number,
    limit: number,
  ) {
    return this.repo.transaction(false, async (s, tx) => {
      const c = await this.entry(s, tx, userId, termId, proposalId, kind);
      const rows = c.row ? await s.sheetHistory(c.row.id, after, limit) : [];
      return {
        items: await Promise.all(
          rows.slice(0, limit).map(async (r) => {
            const valid = c.row ? await this.verifiedSheet(s, c.row, r) : null;
            return {
              revision: r.revision,
              state: r.state,
              actorUserId: r.recordedByUserId,
              recordedAt: r.recordedAt.toISOString(),
              integrity: valid ? "VERIFIED" : "UNKNOWN",
              draft: valid?.draft ?? null,
              total: valid?.total ?? null,
            };
          }),
        ),
        nextRevision: rows.length > limit ? rows[limit - 1].revision : null,
      };
    });
  }
  async aggregate(
    s: GradingSession,
    tx: Prisma.TransactionClient,
    userId: string,
    termId: string,
    proposalId: string,
  ) {
    const p = await s.proposal(proposalId);
    if (!p || p.termId !== termId || p.topic.termId !== termId)
      gradingError(404, "GRADING_PROPOSAL_NOT_FOUND", "Không tìm thấy hồ sơ.");
    const departmentId =
      p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
        ?.departmentId ?? null;
    await this.faculty(s, userId, termId, "read-results", departmentId);
    const chain = await this.sources.chain(s, tx, termId, true),
      reviewerId = chain.reviewer.snapshot.reviewers.find(
        (r) => r.proposalId === proposalId,
      )?.reviewerIds[0];
    if (!reviewerId)
      gradingError(
        409,
        "GRADING_NOT_ADMITTED",
        "Hồ sơ không thuộc danh sách bảo vệ hiện hành.",
      );
    const loaded = await this.sources.read(
        s,
        tx,
        termId,
        proposalId,
        "REVIEWER",
        reviewerId,
      ),
      policyRow = await s.policyRecord(termId),
      policy = readGradingPolicy(policyRow),
      rows = await s.sheets(termId, proposalId),
      resultRow = await s.result(proposalId),
      members = chain.committee.snapshot.committees.find((c) =>
        c.proposalIds.includes(proposalId),
      )!.members,
      blockers = [...loaded.blockers],
      grades: SheetSnapshot[] = [],
      gradeRefs: { id: string; revision: number; hash: string }[] = [];
    if (policy?.calculation.state !== "CONFIRMED")
      blockers.push("CALCULATION_POLICY_NEEDS_APPROVAL");
    for (const [kind, lecturerId] of [
      ["REVIEWER", reviewerId],
      ...members.map((m) => ["COMMITTEE", m.lecturerId]),
    ] as [GradingKind, string][]) {
      const source = await this.sources.read(
          s,
          tx,
          termId,
          proposalId,
          kind,
          lecturerId,
        ),
        row = rows.find(
          (r) =>
            r.kind === kind &&
            readSheet(r)?.source.scorerLecturerId === lecturerId,
        ),
        a =
          row?.current && readSheet(row)
            ? await this.verifiedSheet(s, row, row.current)
            : null,
        scorer = row ? await s.principal(row.scorerUserId) : null;
      if (!a || a.state !== "SEALED") {
        blockers.push(`MISSING_SEALED_${kind}:${lecturerId}`);
        continue;
      }
      if (
        !scorer?.lecturer?.isActive ||
        scorer.status !== "ACTIVE" ||
        scorer.mustChangePassword ||
        scorer.lecturer.id !== lecturerId ||
        source.blockers.length ||
        hashJson(a.source) !== hashJson(source.snapshot) ||
        hashJson(a.rubric) !==
          hashJson(
            kind === "REVIEWER" ? reviewerRubric : policy?.committeeRubric,
          )
      )
        blockers.push(`STALE_GRADE:${lecturerId}`);
      grades.push(a);
      gradeRefs.push({
        id: row!.current!.id,
        revision: a.revision,
        hash: row!.current!.contentHash,
      });
    }
    if (
      new Set(grades.map((g) => `${g.kind}:${g.actorUserId}`)).size !==
      grades.length
    )
      blockers.push("DUPLICATE_SCORER");
    const advisor = verifyAdvisorGrade(
        await this.advisor.read(termId, proposalId, tx),
        termId,
        proposalId,
        await s.now(),
      ),
      source = loaded.snapshot;
    if (
      advisor.state !== "VERIFIED" ||
      !source ||
      advisor.advisorUserId !== source.advisorUserId ||
      hashJson(advisor.assignment) !== hashJson(source.assignment) ||
      hashJson(advisor.pdf) !==
        hashJson({
          finalReportId: source.pdf.finalReportId,
          revision: source.pdf.revision,
          checksum: source.pdf.checksum,
        }) ||
      !Number.isFinite(advisor.score) ||
      advisor.score < 0 ||
      advisor.score > 10 ||
      !/^[0-9a-f]{64}$/.test(advisor.hash)
    )
      blockers.push("ADVISOR_GRADE_UNKNOWN_OR_STALE");
    const council = verifyCouncilConfirmation(
      await this.council.read(termId, proposalId, tx),
      termId,
      proposalId,
      await s.now(),
      {
        id: chain.schedule!.record.id,
        revision: chain.schedule!.record.workflowRevision,
        hash: chain.schedule!.record.contentHash,
      },
      gradeRefs,
    );
    if (
      council.state !== "VERIFIED" ||
      council.scheduleArtifactId !== chain.schedule!.record.id ||
      hashJson([...council.gradeRevisionIds].sort()) !==
        hashJson(gradeRefs.map((g) => g.id).sort()) ||
      !/^[0-9a-f]{64}$/.test(council.contentHash)
    )
      blockers.push("COUNCIL_RESULT_CONFIRMATION_NEEDS_APPROVAL");
    const calculation =
      policy?.calculation.state === "CONFIRMED"
        ? policy.calculation.policy
        : null;
    const parameters = readGradingParameters(
      termId,
      await s.gradingParameters(termId),
      await s.now(),
    );
    if (parameters.state !== "VERIFIED")
      blockers.push("GRADING_PARAMETERS_UNVERIFIED");
    else if (calculation && !parametersMatchPolicy(parameters, calculation))
      blockers.push("CALCULATION_PARAMETER_PROFILE_UNSUPPORTED");
    const totals =
        calculation &&
        advisor.state === "VERIFIED" &&
        grades.length === members.length + 1 &&
        !blockers.length
          ? calculateGrades(
              calculation,
              advisor.score,
              grades.find((g) => g.kind === "REVIEWER")!.total!,
              grades.filter((g) => g.kind === "COMMITTEE").map((g) => g.total!),
            )
          : null,
      expectedContext = hashJson({
        policyRow,
        sources: loaded.fingerprint,
        chain,
        rows,
        resultRow,
        advisor,
        council,
        parameters,
      });
    const view: AggregateView = {
      proposalId,
      studentName: p.student.fullName,
      title: p.topic.title,
      state: !resultRow
        ? "ABSENT"
        : ((await this.verifiedResult(s, resultRow))?.state ?? "INVALID"),
      revision: resultRow?.revision ?? 0,
      expectedContext,
      blockers,
      process: totals?.process ?? null,
      committee: totals?.committee ?? null,
      final: totals?.final ?? null,
      passed: totals?.passed ?? null,
      canSeal: false,
      canPublish: false,
    };
    try {
      this.mutable(loaded.term);
      assertOpen(policy, "PUBLICATION", await s.now());
    } catch {
      blockers.push("PUBLICATION_WINDOW_OR_TERM_CLOSED");
    }
    view.canSeal =
      !blockers.length &&
      !resultRow &&
      hasGradingPermission(
        await this.actor(s, userId, "read-results"),
        "seal-results",
      );
    view.canPublish =
      !blockers.length &&
      resultRow?.state === "SEALED" &&
      hasGradingPermission(
        await this.actor(s, userId, "read-results"),
        "publish",
      );
    return {
      view,
      loaded,
      policyRow,
      policy,
      resultRow,
      departmentId,
      gradeRefs,
      advisor,
      totals,
      calculation,
      parameters,
      council,
      grades,
    };
  }
  async preview(userId: string, termId: string) {
    return this.repo.transaction(false, async (s, tx) => {
      await this.actor(s, userId, "read-results");
      const scope = academicTermScope(
        await s.grants(userId, termId),
        userId,
        termId,
      );
      if (!scope.configured)
        gradingError(403, "GRADING_GRANT_REQUIRED", "Cần grant đúng đợt.");
      const proposals = await s.dossiers(termId),
        items: AggregateView[] = [],
        chain = await this.sources.chain(s, tx, termId, true);
      for (const p of proposals)
        if (
          scope.contains(
            p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
              ?.departmentId,
          )
        ) {
          if (
            !chain.root.students.some(
              (x) => x.proposalId === p.id && x.admitted,
            )
          ) {
            items.push({
              proposalId: p.id,
              studentName: p.student.fullName,
              title: p.topic.title,
              state: "ABSENT",
              revision: 0,
              expectedContext: hashJson({
                proposalId: p.id,
                source: chain.rootRow.contentHash,
              }),
              blockers: ["NOT_ADMITTED"],
              process: null,
              committee: null,
              final: null,
              passed: null,
              canSeal: false,
              canPublish: false,
            });
          } else
            items.push(
              (await this.aggregate(s, tx, userId, termId, p.id)).view,
            );
        }
      return {
        termId,
        items,
        needsApproval: items.some((item) =>
          item.blockers.some((code) =>
            [
              "CALCULATION_POLICY_NEEDS_APPROVAL",
              "ADVISOR_GRADE_UNKNOWN_OR_STALE",
              "COUNCIL_RESULT_CONFIRMATION_NEEDS_APPROVAL",
            ].includes(code),
          ),
        ),
      };
    });
  }
  async resultCommand(
    userId: string,
    termId: string,
    proposalId: string,
    raw: GradingCommand,
    publish: boolean,
  ) {
    const input = workflowCommandSchema.parse(raw);
    return this.repo.transaction(true, async (s, tx) => {
      await this.actor(s, userId, publish ? "publish" : "seal-results");
      await s.lockGrading(termId);
      const c = await this.aggregate(s, tx, userId, termId, proposalId);
      await this.faculty(
        s,
        userId,
        termId,
        publish ? "publish" : "seal-results",
        c.departmentId,
      );
      this.mutable(c.loaded.term);
      assertOpen(c.policy, "PUBLICATION", await s.now());
      const action = `${termId}:${proposalId}:${publish ? "PUBLISH_RESULT" : "SEAL_RESULT"}`,
        replay = await this.replay(
          s,
          userId,
          action,
          input,
          c.view.expectedContext,
        );
      if (replay) return replay;
      this.expected(input, c.resultRow?.revision ?? 0, c.view.expectedContext);
      if (
        c.view.blockers.length ||
        !c.calculation ||
        !c.totals ||
        c.parameters.state !== "VERIFIED" ||
        c.advisor.state !== "VERIFIED"
      )
        gradingError(
          409,
          "GRADING_RESULT_NEEDS_APPROVAL",
          "Chưa được chốt/công bố: policy, nguồn GVHD hoặc xác nhận Hội đồng chưa được duyệt.",
        );
      // Kept as a complete transactional writer for the approved adapter/policy
      // integration. Current UNKNOWN adapters keep this branch unreachable.
      if (
        publish
          ? c.resultRow?.state !== "SEALED" ||
            !(await this.verifiedResult(s, c.resultRow))
          : !!c.resultRow
      )
        gradingError(
          409,
          "GRADING_RESULT_STATE_INVALID",
          "Trạng thái kết quả không cho phép thao tác.",
        );
      if (publish) {
        const old = (await this.verifiedResult(s, c.resultRow))!;
        if (
          old.sourceHash !== c.loaded.fingerprint ||
          hashJson(old.policy) !== hashJson(c.calculation) ||
          hashJson([old.reviewer, ...old.committee]) !==
            hashJson(c.gradeRefs) ||
          old.advisor.hash !== c.advisor.hash ||
          c.council.state !== "VERIFIED" ||
          old.council.hash !== c.council.contentHash ||
          old.process !== c.totals.process ||
          old.committeeScore !== c.totals.committee ||
          old.final !== c.totals.final ||
          old.passed !== c.totals.passed
        )
          gradingError(
            409,
            "GRADING_SEALED_RESULT_STALE",
            "Nguồn khác bản kết quả đã chốt; không tự tính lại để công bố.",
          );
      }
      if (!c.resultRow) await s.createResult(termId, proposalId);
      const revision = (c.resultRow?.revision ?? 0) + 1,
        id = randomUUID(),
        at = await s.now(),
        state = publish ? "PUBLISHED" : "SEALED";
      const snap = resultSnapshotSchema.parse({
        schemaVersion: 1,
        termId,
        proposalId,
        revision,
        state,
        recordedAt: at.toISOString(),
        actorUserId: userId,
        policyRevision: c.policyRow!.revision,
        policyHash: c.policyRow!.current!.contentHash,
        policy: c.calculation,
        parameters: c.parameters.evidence,
        sourceHash: c.loaded.fingerprint,
        reviewer: c.gradeRefs[0],
        committee: c.gradeRefs.slice(1),
        advisor: {
          id: c.advisor.id,
          revision: c.advisor.revision,
          hash: c.advisor.hash,
          score: c.advisor.score,
          evidence: c.advisor,
        },
        council:
          c.council.state === "VERIFIED"
            ? {
                id: c.council.id,
                revision: c.council.revision,
                hash: c.council.contentHash,
                scheduleArtifactId: c.council.scheduleArtifactId,
                gradeRevisionIds: c.council.gradeRevisionIds,
                evidence: c.council,
              }
            : null,
        gradeValues: {
          reviewer: c.grades.find((g) => g.kind === "REVIEWER")!.total!,
          committee: c.grades
            .filter((g) => g.kind === "COMMITTEE")
            .map((g) => g.total!),
        },
        process: c.totals.process,
        committeeScore: c.totals.committee,
        final: c.totals.final,
        passed: c.totals.passed,
      });
      await s.resultVersion({
        id,
        termId,
        proposalId,
        revision,
        state,
        snapshot: asJson(snap),
        contentHash: hashJson(snap),
        policyRevision: c.policyRow!.revision,
        recordedAt: at,
        recordedByUserId: userId,
      });
      if (
        (await s.resultUpdate(proposalId, revision - 1, id, state)).count !== 1
      )
        gradingError(409, "GRADING_REVISION_CONFLICT", "Kết quả đã thay đổi.");
      await this.audit.log(
        {
          userId,
          resource: "grading-result",
          resourceId: proposalId,
          action: state,
          oldValue: { revision: revision - 1 },
          newValue: { revision, contentHash: hashJson(snap) },
        },
        tx,
      );
      if (publish)
        await s.notifyRecipients(
          [c.loaded.p.student.userId],
          termId,
          "Kết quả đồ án đã công bố",
          `/grading/results?termId=${encodeURIComponent(termId)}&proposalId=${encodeURIComponent(proposalId)}`,
        );
      const latest = await this.aggregate(s, tx, userId, termId, proposalId);
      await this.faculty(
        s,
        userId,
        termId,
        publish ? "publish" : "seal-results",
        latest.departmentId,
      );
      this.mutable(latest.loaded.term);
      assertOpen(latest.policy, "PUBLICATION", await s.now());
      if (
        latest.loaded.fingerprint !== c.loaded.fingerprint ||
        hashJson(latest.gradeRefs) !== hashJson(c.gradeRefs) ||
        hashJson(latest.advisor) !== hashJson(c.advisor) ||
        hashJson(latest.council) !== hashJson(c.council) ||
        hashJson(latest.parameters) !== hashJson(c.parameters) ||
        latest.policyRow?.currentRevisionId !==
          c.policyRow?.currentRevisionId ||
        latest.view.blockers.length
      )
        gradingError(
          409,
          "GRADING_CONTEXT_CHANGED",
          "Nguồn thay đổi trong transaction.",
        );
      const result = {
        changed: true,
        revision,
        expectedContext: latest.view.expectedContext,
      };
      await this.remember(s, userId, action, input, result);
      assertOpen(latest.policy, "PUBLICATION", await s.now());
      return result;
    });
  }
  async published(
    userId: string,
    termId: string,
    proposalId: string,
  ): Promise<PublishedGrade> {
    return this.repo.transaction(false, async (s) => {
      const u = await this.actor(s, userId, "read-published"),
        p = await s.proposal(proposalId);
      if (!p || p.termId !== termId || p.topic.termId !== termId)
        gradingError(
          404,
          "GRADING_PROPOSAL_NOT_FOUND",
          "Không tìm thấy hồ sơ trong phạm vi.",
        );
      if (
        u.student?.id !== p.studentId ||
        u.student.userId !== userId ||
        !u.student.isActive
      ) {
        await this.faculty(
          s,
          userId,
          termId,
          "read-results",
          p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
            ?.departmentId ?? null,
        );
      }
      const row = await s.result(proposalId),
        a = await this.verifiedResult(s, row);
      // No term-wide publication flag, legacy FinalResult or ScoreEntry.isLocked.
      if (!a || a.state !== "PUBLISHED" || row?.termId !== termId)
        return {
          configured: !!row,
          state: "NOT_PUBLISHED",
          proposalId,
          revision: 0,
          publishedAt: null,
          result: null,
        };
      return {
        configured: true,
        state: "PUBLISHED",
        proposalId,
        revision: a.revision,
        publishedAt: a.recordedAt,
        result: {
          process: a.process,
          committee: a.committeeScore,
          final: a.final,
          passed: a.passed,
          policyVersion: a.policyRevision,
        },
      };
    });
  }
  async resultHistory(
    userId: string,
    termId: string,
    proposalId: string,
    after: number,
    limit: number,
  ) {
    return this.repo.transaction(false, async (s) => {
      const p = await s.proposal(proposalId);
      if (!p || p.termId !== termId)
        gradingError(
          404,
          "GRADING_PROPOSAL_NOT_FOUND",
          "Không tìm thấy hồ sơ.",
        );
      await this.faculty(
        s,
        userId,
        termId,
        "read-results",
        p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
          ?.departmentId ?? null,
      );
      const rows = await s.resultHistory(proposalId, after, limit);
      return {
        items: await Promise.all(
          rows.slice(0, limit).map(async (r) => ({
            revision: r.revision,
            state: r.state,
            recordedAt: r.recordedAt.toISOString(),
            actorUserId: r.recordedByUserId,
            integrity: (await this.verifiedResult(s, {
              termId,
              proposalId,
              revision: r.revision,
              state: r.state,
              currentRevisionId: r.id,
              current: r,
            }))
              ? "VERIFIED"
              : "UNKNOWN",
          })),
        ),
        nextRevision: rows.length > limit ? rows[limit - 1].revision : null,
      };
    });
  }
  async myResults(userId: string, termId: string) {
    return this.repo.transaction(false, async (s) => {
      const u = await this.actor(s, userId, "read-published");
      if (!u.student?.isActive)
        gradingError(
          403,
          "GRADING_STUDENT_REQUIRED",
          "Cần sinh viên hoạt động.",
        );
      const proposals = await s.dossiers(termId, u.student.id),
        items: PublishedGrade[] = [];
      for (const p of proposals) {
        if (
          p.student.userId !== userId ||
          p.studentId !== u.student.id ||
          p.termId !== termId
        )
          continue;
        const a = await this.verifiedResult(s, await s.result(p.id));
        items.push(
          a?.termId === termId && a.state === "PUBLISHED"
            ? {
                configured: true,
                state: "PUBLISHED",
                proposalId: p.id,
                revision: a.revision,
                publishedAt: a.recordedAt,
                result: {
                  process: a.process,
                  committee: a.committeeScore,
                  final: a.final,
                  passed: a.passed,
                  policyVersion: a.policyRevision,
                },
              }
            : {
                configured: false,
                state: "NOT_PUBLISHED",
                proposalId: p.id,
                revision: 0,
                publishedAt: null,
                result: null,
              },
        );
      }
      return { termId, items };
    });
  }
  async policyHistory(
    userId: string,
    termId: string,
    after: number,
    limit: number,
  ) {
    return this.repo.transaction(false, async (s) => {
      await this.faculty(s, userId, termId, "configure", null, true);
      const rows = await s.policyHistory(termId, after, limit);
      return {
        items: rows.slice(0, limit).map((r) => ({
          revision: r.revision,
          recordedAt: r.recordedAt.toISOString(),
          actorUserId: r.recordedByUserId,
          contentHash: r.contentHash,
          integrity: readGradingPolicy({
            termId,
            revision: r.revision,
            currentRevisionId: r.id,
            current: r,
          })
            ? "VERIFIED"
            : "UNKNOWN",
        })),
        nextRevision: rows.length > limit ? rows[limit - 1].revision : null,
      };
    });
  }
  async download(
    userId: string,
    termId: string,
    proposalId: string,
    kind: GradingKind,
    raw: unknown,
  ) {
    const identity = gradingPdfIdentitySchema.parse(raw);
    // ReadCommitted to recheck current facts after waiting on the term/file locks.
    // SELECT/locks only; no sheet, decision, eligibility, audit or download marker.
    return this.repo.transaction(true, async (s, tx) => {
      await this.actor(s, userId, "read");
      await s.lockGrading(termId);
      const c = await this.entry(s, tx, userId, termId, proposalId, kind),
        pdf = c.loaded.pdf;
      if (
        c.loaded.blockers.length ||
        pdf.state !== "READY" ||
        !pdf.snapshot ||
        !c.loaded.bytes ||
        hashJson(identity) !==
          hashJson({
            finalReportId: pdf.snapshot.finalReportId,
            revision: pdf.snapshot.revision,
            checksum: pdf.snapshot.checksum,
          })
      )
        gradingError(
          409,
          "GRADING_PDF_CHANGED",
          "Không xác minh được đúng PDF theo context; hãy tải lại.",
        );
      const latest = await this.entry(s, tx, userId, termId, proposalId, kind);
      if (latest.loaded.fingerprint !== c.loaded.fingerprint)
        gradingError(409, "GRADING_PDF_CHANGED", "PDF/phân công đã thay đổi.");
      return { bytes: c.loaded.bytes, name: pdf.snapshot.originalName };
    });
  }
}
