import { Injectable, HttpException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import { randomUUID } from "crypto";
import { Prisma, GuidanceSubmissionUpload } from "@prisma/client";
import type {
  SubmissionFileKind,
  SubmissionFileView,
  SubmissionUploadView,
  TaskSubmissionCreate,
  TaskSubmissionView,
  TaskSubmissionContext,
} from "@doan/shared";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { groupError } from "../../topic/review-groups/review-group.errors";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import { GuidanceService } from "../tasks/guidance.service";
import { GuidanceValidator } from "../tasks/guidance.validator";
import {
  SubmissionRepository,
  SubmissionSession,
  SubmissionRecord,
} from "./submission.repository";
import { SubmissionValidator, digest } from "./submission.validator";
import { readSubmissionPolicy } from "./submission-policy";
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
type Access = Awaited<ReturnType<GuidanceService["submissionAccess"]>>;
@Injectable()
export class SubmissionService {
  private readonly logger = new Logger(SubmissionService.name);
  private cleaning = false;
  constructor(
    private readonly repo: SubmissionRepository,
    private readonly guidance: GuidanceService,
    private readonly gv: GuidanceValidator,
    private readonly review: ProposalReviewValidator,
    private readonly v: SubmissionValidator,
    private readonly storage: FileStorageService,
    private readonly config: ConfigService,
  ) {}
  policy() {
    if (this.config.get("GUIDANCE_UPLOAD_ENABLED", "true") !== "true")
      groupError(
        409,
        "FILE_POLICY_NOT_CONFIGURED",
        "Nộp file đang tạm khóa bởi cấu hình.",
      );
    return readSubmissionPolicy(
      this.config.get<string>("GUIDANCE_UPLOAD_POLICY_JSON"),
    );
  }
  key(key: string) {
    if (!key || key.length > 200 || !/^[\w.-]+$/.test(key))
      groupError(400, "COMMON_003", "Thiếu hoặc sai Idempotency-Key.");
  }
  private async locked(s: SubmissionSession, userId: string, taskId: string) {
    let a = await this.guidance.submissionAccess(s, userId, taskId, "create");
    await s.lock(a.p.topic.termId, [], a.p.id);
    await s.lockAggregate(
      a.plan.id,
      a.t.pr2bTaskWorkflowTaskId?.obligationId ?? undefined,
      taskId,
    );
    a = await this.guidance.submissionAccess(s, userId, taskId, "create");
    return a;
  }
  private async ready(s: SubmissionSession, a: Access) {
    const active = await this.gv.active(s, a.p, a.plan),
      w = this.v.task(a.t);
    if (await s.legacySubmissionCount(a.t.id))
      groupError(
        409,
        "INPUT_NOT_READY",
        "Bài nộp legacy cần đối soát trước khi mở chuỗi phiên bản mới.",
      );
    this.gv.period(await s.period(w.periodId!), a.p.topic.termId);
    this.gv.dates(
      w.startsAt!,
      a.t.deadline,
      await this.gv.phase(s, a.p.topic.termId),
    );
    if (w.kind === "WEEKLY_REPORT") {
      const o = w.obligationId ? await s.obligation(w.obligationId) : null;
      if (!o || o.currentTaskId !== a.t.id)
        groupError(
          409,
          "REPORTING_SCOPE_NOT_CONFIGURED",
          "Nhiệm vụ không phải nghĩa vụ tuần hiện hành.",
        );
      this.gv.obligation(
        o,
        this.review.ownership(a.p).termStudentId!,
        a.p.topic.termId,
      );
    }
    return { active, w };
  }
  async preflight(userId: string, taskId: string) {
    return this.repo.transaction(async (s) => {
      const a = await this.guidance.submissionAccess(
        s,
        userId,
        taskId,
        "create",
      );
      await this.ready(s, a);
      return this.policy();
    });
  }
  async context(
    userId: string,
    taskId: string,
  ): Promise<TaskSubmissionContext> {
    return this.repo.transaction(async (s) => {
      const a = await this.guidance.submissionAccess(s, userId, taskId, "read"),
        readiness: string[] = [];
      let canSubmit = false,
        policy: ReturnType<typeof this.policy> | null = null;
      try {
        policy = this.policy();
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
        readiness.push("FILE_POLICY_NOT_CONFIGURED");
      }
      try {
        await this.guidance.submissionAccess(s, userId, taskId, "create");
        await this.ready(s, a);
        canSubmit = !!policy;
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
        readiness.push(
          (e.getResponse() as { error?: { code?: string } }).error?.code ??
            "INPUT_NOT_READY",
        );
      }
      return {
        taskId,
        taskRevision: a.t.pr2bTaskWorkflowTaskId?.revision ?? 0,
        canSubmit,
        readiness,
        policy,
        latePolicy: "ACCEPT_WHILE_PHASE_OPEN",
        dueDate: a.t.deadline.toISOString(),
        currentSubmissionId:
          a.t.pr2bTaskWorkflowTaskId?.currentSubmissionId ?? null,
      };
    });
  }
  private uploadView(
    u: GuidanceSubmissionUpload & { asset: { id: string } | null },
  ): SubmissionUploadView {
    return {
      id: u.id,
      expiresAt: u.expiresAt.toISOString(),
      file: {
        ...(u.manifest as unknown as SubmissionFileView),
        id: u.assetId!,
      },
    };
  }
  async stage(
    userId: string,
    taskId: string,
    kind: SubmissionFileKind,
    file: Express.Multer.File,
    key: string,
  ) {
    this.key(key);
    const policy = this.policy(),
      manifest = this.v.file(kind, file, policy),
      hash = reviewHash({ manifest, policy });
    const intent = await this.repo.transaction(async (s) => {
      const a = await this.locked(s, userId, taskId);
      await this.ready(s, a);
      const old = await s.uploadByKey(userId, taskId, key);
      if (old) {
        if (old.payloadHash !== hash)
          groupError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Khóa đã dùng với file khác.",
          );
        if (old.expiresAt <= new Date() || old.state === "EXPIRED")
          groupError(
            409,
            "UPLOAD_EXPIRED",
            "File staging đã hết hạn; hãy tải lại.",
          );
        if (old.state === "PENDING")
          groupError(409, "UPLOAD_IN_PROGRESS", "Upload cùng khóa đang xử lý.");
        return { u: old, fresh: false };
      }
      if ((await s.pendingCount(userId)) >= policy.maxPendingFilesPerStudent)
        groupError(
          429,
          "UPLOAD_QUOTA_EXCEEDED",
          "Quá nhiều file staging chưa nộp.",
        );
      const id = randomUUID(),
        u = await s.addUpload({
          id,
          taskId,
          actorId: userId,
          requestKey: key,
          payloadHash: hash,
          storageKey: `guidance/${id}`,
          manifest: json(manifest),
          policySnapshot: json(policy),
          expiresAt: new Date(Date.now() + policy.stagingTtlHours * 3600000),
        });
      await this.gv.phase(s, a.p.topic.termId);
      return { u, fresh: true };
    }, true);
    if (!intent.fresh) return this.uploadView(intent.u);
    try {
      await this.storage.savePrivateGuidance(intent.u.storageKey, file.buffer);
      const done = await this.repo.transaction(async (s) => {
        const a = await this.locked(s, userId, taskId);
        await this.ready(s, a);
        await s.lockUpload(intent.u.id);
        const u = await s.upload(intent.u.id);
        if (!u || u.state !== "PENDING" || u.expiresAt <= new Date())
          groupError(409, "UPLOAD_EXPIRED", "Upload đã hết hạn.");
        if (reviewHash(this.policy()) !== reviewHash(u.policySnapshot))
          groupError(
            409,
            "FILE_POLICY_CHANGED",
            "Policy đã đổi; tải lại file.",
          );
        const asset = await s.addAsset({
          ...manifest,
          createdByUserId: userId,
          storageKey: u.storageKey,
          state: "READY",
        });
        const result = await s.updateUpload(u.id, {
          assetId: asset.id,
          state: "READY",
        });
        await s.guidanceAudit(
          userId,
          taskId,
          "SUBMISSION_UPLOAD_READY",
          json({ uploadId: u.id, checksum: manifest.checksum }),
        );
        await this.gv.phase(s, a.p.topic.termId);
        return result;
      }, true);
      return this.uploadView(done);
    } catch (e) {
      // Persist intent even after IO/metadata failure; sweeper can recover a crash/orphan.
      await this.repo
        .transaction(async (s) => {
          await s.lockUpload(intent.u.id);
          const u = await s.upload(intent.u.id);
          if (u && ["PENDING", "READY"].includes(u.state))
            await s.updateUpload(u.id, {
              state: "EXPIRED",
              expiresAt: new Date(),
            });
        }, true)
        .catch(() =>
          this.logger.warn("Upload cleanup deferred; private intent retained"),
        );
      await this.cleanup().catch(() => undefined);
      if (e instanceof HttpException) throw e;
      groupError(
        503,
        "UPLOAD_FAILED",
        "Không lưu được file; chưa có bài nộp được tạo.",
      );
    }
  }
  view(s: SubmissionRecord): TaskSubmissionView {
    const w = s.pr2bSubmissionWorkflowSubmissionId;
    return {
      id: s.id,
      taskId: s.taskId,
      versionNumber: w?.versionNumber ?? null,
      state: w?.state ?? null,
      submittedBy: w?.submittedByUserId ?? null,
      submittedAt: w?.submittedAt?.toISOString() ?? null,
      deadlineSnapshot: w?.deadlineSnapshot?.toISOString() ?? null,
      isLate: w?.isLate ?? null,
      revision: w?.revision ?? 0,
      content: s.content,
      contextSnapshot: w?.contextSnapshot ?? null,
      files: s.pr2bSubmissionAssetSubmissionId.map(({ refFileId: f }) => ({
        id: f.id,
        kind: f.kind as SubmissionFileKind,
        originalName: f.originalName,
        sizeBytes: f.sizeBytes,
        mimeType: f.mimeType,
        checksum: f.checksum,
      })),
    };
  }
  async list(
    userId: string,
    taskId: string,
    q: { page: number; limit: number },
  ) {
    return this.repo.transaction(async (s) => {
      const a = await this.guidance.submissionAccess(s, userId, taskId, "read"),
        total = await s.submissionCount(taskId);
      return {
        data: (
          await s.submissionPage(taskId, (q.page - 1) * q.limit, q.limit)
        ).map((x) => this.view(x)),
        total,
        page: q.page,
        limit: q.limit,
        totalPages: Math.ceil(total / q.limit),
        currentSubmissionId:
          a.t.pr2bTaskWorkflowTaskId?.currentSubmissionId ?? null,
      };
    });
  }
  async detail(userId: string, id: string) {
    return this.repo.transaction(async (s) => {
      const sub = await s.submission(id);
      if (!sub) groupError(404, "COMMON_001", "Không tìm thấy bài nộp.");
      await this.guidance.submissionAccess(s, userId, sub.taskId, "read");
      return this.view(sub);
    });
  }
  async submit(
    userId: string,
    taskId: string,
    input: TaskSubmissionCreate,
    key: string,
  ): Promise<TaskSubmissionView> {
    this.key(key);
    return this.repo.transaction(async (s) => {
      const a = await this.locked(s, userId, taskId),
        route = `/tasks/${taskId}/submissions`,
        hash = reviewHash(input),
        replay = await s.guidanceReplay(userId, "POST", route, key);
      if (replay) {
        if (replay.payloadHash !== hash)
          groupError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Khóa nộp đã dùng với dữ liệu khác.",
          );
        return replay.result as unknown as TaskSubmissionView;
      }
      const { active, w } = await this.ready(s, a),
        policy = this.policy();
      this.review.revision(w.revision, input.expectedTaskRevision);
      const uploads = [];
      for (const id of [...input.uploadIds].sort()) {
        await s.lockUpload(id);
        const u = await s.upload(id);
        if (!u || u.actorId !== userId || u.taskId !== taskId)
          groupError(404, "COMMON_001", "Không tìm thấy upload trong hồ sơ.");
        if (
          u.state !== "READY" ||
          !u.asset ||
          u.asset.state !== "READY" ||
          u.expiresAt <= new Date()
        )
          groupError(409, "FILE_NOT_READY", "File chưa sẵn sàng hoặc hết hạn.");
        if (reviewHash(policy) !== reviewHash(u.policySnapshot))
          groupError(
            409,
            "FILE_POLICY_CHANGED",
            "Policy đã đổi; tải lại file.",
          );
        const f = u.asset;
        // IO bounded by approved per-file limits, under locks; no user file is executed/extracted.
        let bytes: Buffer;
        try {
          bytes = await this.storage.readPrivateGuidance(
            u.storageKey,
            policy.maxFileBytes,
          );
        } catch {
          groupError(409, "FILE_NOT_READY", "File private không còn sẵn sàng.");
        }
        if (
          bytes.length !== f.sizeBytes ||
          digest(bytes) !== f.checksum ||
          f.createdByUserId !== userId ||
          f.storageKey !== u.storageKey ||
          reviewHash(u.manifest) !==
            reviewHash({
              kind: f.kind,
              originalName: f.originalName,
              sizeBytes: f.sizeBytes,
              mimeType: f.mimeType,
              checksum: f.checksum,
            })
        )
          groupError(409, "FILE_NOT_READY", "File không khớp metadata.");
        uploads.push(u);
      }
      for (const kind of ["REPORT", "SOURCE", "EVIDENCE"] as const) {
        const count = uploads.filter((u) => u.asset!.kind === kind).length;
        if (
          (kind !== "EVIDENCE" && count !== 1) ||
          count > policy.roles[kind].maxFiles
        )
          groupError(
            400,
            "REQUIRED_FILE_MISSING",
            "Cần 1 báo cáo, 1 source và số minh chứng đúng cấu hình.",
          );
      }
      if (
        uploads.reduce((sum, u) => sum + u.asset!.sizeBytes, 0) >
        policy.maxSubmissionBytes
      )
        groupError(413, "FILE_TOO_LARGE", "Tổng file vượt cấu hình.");
      // Recheck wall clock after IO; time spent uploading is not a submitted timestamp.
      await this.ready(s, a);
      const submittedAt = new Date(),
        number = w.nextSubmissionNumber!;
      if (uploads.some((u) => u.expiresAt <= submittedAt))
        groupError(
          409,
          "FILE_NOT_READY",
          "File staging hết hạn trong lúc xử lý; hãy tải lại.",
        );
      const snapshot = {
        schemaVersion: 1,
        termId: a.p.topic.termId,
        termStudentId: this.review.ownership(a.p).termStudentId,
        studentId: a.p.studentId,
        proposalId: a.p.id,
        topicId: a.p.topicId,
        planId: a.plan.id,
        periodId: w.periodId,
        advisorId: active.official.assignment.advisorId,
        assignmentId: active.official.assignment.id,
        assignmentRevision: active.official.revision,
        finalizationId: active.final.f.id,
        files: uploads.map((u) => ({
          uploadId: u.id,
          fileId: u.assetId,
          ...(u.manifest as object),
        })),
      };
      const sub = await s.addSubmission({
        taskId,
        content: input.content,
        createdAt: submittedAt,
        pr2bSubmissionWorkflowSubmissionId: {
          create: {
            taskId,
            versionNumber: number,
            state: "SUBMITTED",
            submittedAt,
            deadlineSnapshot: a.t.deadline,
            isLate: this.v.late(submittedAt, a.t.deadline),
            submittedByUserId: userId,
            contextSnapshot: json(snapshot),
            filePolicySnapshot: json(policy),
          },
        },
      });
      if (w.currentSubmissionId) await s.supersede(w.currentSubmissionId);
      for (const u of uploads) {
        await s.linkAsset(sub.id, u.assetId!);
        await s.updateUpload(u.id, {
          state: "COMMITTED",
          submissionId: sub.id,
        });
      }
      await s.advanceTask(taskId, w.revision, {
        state: "SUBMITTED",
        currentSubmissionId: sub.id,
        nextSubmissionNumber: number + 1,
      });
      await s.updateTask(taskId, { status: "SUBMITTED" });
      await s.taskHistory({
        taskId,
        actorId: userId,
        reason: "SUBMISSION_COMMITTED",
        snapshot: json({
          submissionId: sub.id,
          versionNumber: number,
          fromState: w.state,
          toState: "SUBMITTED",
          isLate: this.v.late(submittedAt, a.t.deadline),
        }),
      });
      await s.guidanceAudit(
        userId,
        taskId,
        "SUBMISSION_COMMITTED",
        json({
          submissionId: sub.id,
          manifestHash: reviewHash(snapshot),
          versionNumber: number,
        }),
      );
      const official = await this.review.advisor(s, a.p);
      await s.notify({
        userId: official.assignment.advisor.userId,
        termId: a.p.topic.termId,
        title: "Bài nộp hướng dẫn mới",
        body: "Sinh viên đã nộp báo cáo mới. Mở hồ sơ để xem bài và ghi nhận đánh giá.",
        link: `/guidance/review/${sub.id}`,
      });
      const result = this.view((await s.submission(sub.id))!);
      await this.gv.phase(s, a.p.topic.termId);
      await s.guidanceRemember(userId, "POST", route, key, hash, json(result));
      return result;
    }, true);
  }
  async download(userId: string, submissionId: string, fileId: string) {
    return this.repo.transaction(async (s) => {
      const sub = await s.submission(submissionId);
      if (!sub) groupError(404, "COMMON_001", "Không tìm thấy bài.");
      await this.guidance.submissionAccess(s, userId, sub.taskId, "download");
      const f = sub.pr2bSubmissionAssetSubmissionId.find(
          (x) => x.fileId === fileId,
        )?.refFileId,
        u = await s.assetUpload(fileId);
      if (
        !f ||
        !u ||
        u.state !== "COMMITTED" ||
        u.submissionId !== sub.id ||
        u.taskId !== sub.taskId ||
        f.state !== "READY"
      )
        groupError(404, "COMMON_001", "Không tìm thấy file thuộc bài nộp.");
      let bytes: Buffer;
      try {
        bytes = await this.storage.readPrivateGuidance(
          f.storageKey,
          f.sizeBytes,
        );
      } catch {
        groupError(409, "FILE_NOT_READY", "File private chưa sẵn sàng.");
      }
      if (bytes.length !== f.sizeBytes || digest(bytes) !== f.checksum)
        groupError(409, "FILE_NOT_READY", "Checksum không hợp lệ.");
      return { bytes, name: f.originalName };
    });
  }
  @Interval(60000)
  async cleanup() {
    if (this.cleaning) return;
    this.cleaning = true;
    try {
      const candidates = await this.repo.transaction((s) => s.expired());
      for (const { id } of candidates) {
        try {
          const expired = await this.repo.transaction(async (s) => {
            await s.lockUpload(id);
            const u = await s.upload(id);
            if (
              !u ||
              u.state === "COMMITTED" ||
              u.expiresAt > new Date() ||
              u.cleanedAt ||
              (u.assetId && (await s.assetUsed(u.assetId)))
            )
              return null;
            if (u.assetId) await s.quarantine(u.assetId);
            return s.updateUpload(id, { state: "EXPIRED" });
          }, true);
          if (!expired) continue;
          await this.storage.deletePrivateGuidance(expired.storageKey);
          await this.repo.transaction(
            (s) => s.updateUpload(id, { cleanedAt: new Date() }),
            true,
          );
        } catch {
          this.logger.warn(
            "Private staging cleanup deferred; intent retained for retry",
          );
        }
      }
    } catch {
      this.logger.warn("Private staging sweep unavailable; retry scheduled");
    } finally {
      this.cleaning = false;
    }
  }
}
