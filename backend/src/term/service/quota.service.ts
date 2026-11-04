import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  allocateQuotas,
  directionShortage,
  quotaGroup,
  quotaRosterKey,
  readQuotaPolicy,
  type QuotaApproveInput,
  type QuotaPreviewInput,
  type QuotaPolicy,
} from "@doan/shared";
import { AuditService } from "../../common/audit/audit.service";
import { TermRepository, TermTransaction } from "../repository/term.repository";
import { QuotaValidator as V } from "../validator/quota.validator";
type Context = Awaited<ReturnType<TermRepository["quotaContext"]>>;
const json = (value: QuotaPolicy) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class QuotaService {
  constructor(
    private readonly repo: TermRepository,
    private readonly audit: AuditService,
  ) {}
  private async context(id: string, tx: TermTransaction) {
    const c = await this.repo.quotaContext(id, tx);
    if (!c.term) throw new NotFoundException("Không tìm thấy đợt.");
    V.require(
      !c.term.isLocked && !["COMPLETED", "CANCELLED"].includes(c.term.status),
      "Đợt đã khóa hoặc kết thúc.",
    );
    V.require(
      !c.official,
      "Không thay đổi chính sách chỉ tiêu sau khi công bố phân công.",
    );
    const phase = c.term.phases.find((p) => p.code === "ASSIGNMENT");
    V.require(!phase?.isLocked, "Giai đoạn phân công đã khóa.");
    return c;
  }
  private signature(c: Context) {
    const term = c.term!;
    return createHash("sha256")
      .update(
        JSON.stringify({
          students: term.termStudents
            .map((s) => [
              s.studentId,
              s.student.isActive,
              s.student.academicEligible,
              String(s.student.gpa),
            ])
            .sort(),
          lecturers: term.termLecturers
            .map((l) => [
              l.lecturerId,
              l.quota,
              l.lecturer.isActive,
              l.lecturer.academicDegree,
              l.lecturer.academicRank,
              l.lecturer.researchAreas.map((a) => a.researchAreaId).sort(),
            ])
            .sort(),
          parameters: term.parameters.map((p) => [p.key, p.value]).sort(),
          registrations: c.registrations
            .map((r) => [r.studentId, r.directionId, r.status])
            .sort(),
          assignments: c.assignments
            .map((a) => [a.advisorId, a.registration.studentId])
            .sort(),
        }),
      )
      .digest("hex");
  }
  private directions(
    c: Context,
    members: { lecturerId: string; quota: number }[],
  ) {
    const counts = new Map<string, number>();
    const roster = new Set(c.term!.termStudents.map((s) => s.studentId));
    const assigned = new Set(
      c.assignments.map((a) => a.registration.studentId),
    );
    for (const r of c.registrations)
      if (
        r.status === "SUBMITTED" &&
        roster.has(r.studentId) &&
        !assigned.has(r.studentId) &&
        r.directionId
      )
        counts.set(r.directionId, (counts.get(r.directionId) ?? 0) + 1);
    return directionShortage(
      [...counts].map(([directionId, count]) => ({ directionId, count })),
      members.map((m) => ({
        quota: Math.max(
          0,
          m.quota -
            c.assignments.filter((a) => a.advisorId === m.lecturerId).length,
        ),
        directionIds: c
          .term!.termLecturers.find((l) => l.lecturerId === m.lecturerId)!
          .lecturer.researchAreas.map((a) => a.researchAreaId),
      })),
    );
  }
  preview(id: string, input: QuotaPreviewInput, actor: string) {
    return this.repo.transaction(async (tx) => {
      const c = await this.context(id, tx),
        term = c.term!;
      const previous = readQuotaPolicy(term.quotaPolicy);
      V.revision(previous?.revision ?? 0, input.revision);
      V.require(
        input.settings.basis !== "SUBMITTED" ||
          term.status === "CLOSED_REGISTRATION" ||
          term.status === "IN_PROGRESS",
        "Chỉ tính theo đăng ký đã nộp sau khi đóng đăng ký.",
      );
      const roster = new Set(term.termStudents.map((s) => s.studentId));
      const demandStudentIds = (
        input.settings.basis === "ROSTER"
          ? [...roster]
          : c.registrations
              .filter(
                (r) => r.status === "SUBMITTED" && roster.has(r.studentId),
              )
              .map((r) => r.studentId)
      ).sort();
      const demandCount = demandStudentIds.length;
      const threshold = Number(
        term.parameters.find((p) => p.key === "passing_gpa_threshold")?.value ??
          2,
      );
      V.require(
        term.termStudents
          .filter((s) => demandStudentIds.includes(s.studentId))
          .every(
            (s) =>
              s.student.isActive &&
              s.student.academicEligible &&
              s.student.gpa !== null &&
              Number(s.student.gpa) >= threshold,
          ),
        "Danh sách tính chỉ tiêu có sinh viên chưa đủ điều kiện học vụ/GPA. Cần cập nhật danh sách trước khi tính.",
      );
      V.require(
        demandCount > 0,
        "Chưa có sinh viên trong phạm vi tính chỉ tiêu.",
      );
      V.require(
        term.termLecturers.length > 0,
        "Chọn và lưu giảng viên tham gia trước khi tính.",
      );
      V.require(
        new Set(input.limits.map((l) => l.lecturerId)).size ===
          input.limits.length &&
          input.limits.every((l) =>
            term.termLecturers.some((m) => m.lecturerId === l.lecturerId),
          ),
        "Giới hạn bị trùng hoặc chứa giảng viên ngoài đợt.",
      );
      const members = term.termLecturers
        .map((m) => {
          const l = m.lecturer,
            maxQuota =
              input.limits.find((x) => x.lecturerId === l.id)?.maxQuota ??
              input.settings.defaultLimit;
          const group = quotaGroup(l.academicDegree, l.academicRank);
          V.require(
            maxQuota === 0 || (l.isActive && l.researchAreas.length),
            `${l.fullName} chưa hoạt động hoặc chưa có hướng chuyên môn; đặt giới hạn 0 để không nhận sinh viên.`,
          );
          V.require(
            maxQuota === 0 || group,
            `Cần bổ sung học vị/học hàm cho ${l.fullName} trong Đội ngũ giảng viên.`,
          );
          return {
            lecturerId: l.id,
            code: l.lecturerCode,
            name: l.fullName,
            academicDegree: l.academicDegree,
            academicRank: l.academicRank,
            coefficient:
              maxQuota > 0 && group ? input.settings.factors[group] : 0,
            maxQuota,
            currentCount: c.assignments.filter((a) => a.advisorId === l.id)
              .length,
            idealQuota: 0,
            suggestedQuota: 0,
            quota: m.quota,
            reason: "",
          };
        })
        .sort(
          (a, b) =>
            a.code.localeCompare(b.code, "en") ||
            a.lecturerId.localeCompare(b.lecturerId, "en"),
        );
      let allocation: ReturnType<typeof allocateQuotas>;
      try {
        allocation = allocateQuotas(demandCount, members);
      } catch (error) {
        V.require(false, (error as Error).message);
      }
      members.forEach((m) => {
        const result = allocation.members.find(
          (a) => a.lecturerId === m.lecturerId,
        )!;
        m.idealQuota = result.idealQuota;
        m.suggestedQuota = result.suggestedQuota;
        m.quota = result.suggestedQuota;
      });
      const warnings: string[] = [];
      if (allocation.shortage)
        warnings.push(
          `Thiếu ${allocation.shortage} chỗ hướng dẫn theo giới hạn hiện tại.`,
        );
      const shortage = this.directions(c, members);
      if (shortage)
        warnings.push(
          `Chỉ tiêu đề xuất còn thiếu ${shortage} chỗ đúng hướng chuyên môn cho đăng ký đã nộp. Hãy điều chỉnh trước khi chốt.`,
        );
      if (input.settings.basis === "ROSTER")
        warnings.push(
          "Tính theo toàn bộ danh sách tham gia. Hướng chuyên môn chỉ kiểm tra được cho sinh viên đã nộp đăng ký.",
        );
      const totalCoefficient = members.reduce((n, m) => n + m.coefficient, 0),
        activeCount = members.filter((m) => m.maxQuota > 0).length;
      const policy: QuotaPolicy = {
        version: 1,
        revision: (previous?.revision ?? 0) + 1,
        status: "DRAFT",
        settings: input.settings,
        members,
        demandCount,
        demandStudentIds,
        totalCoefficient,
        averageCoefficient: activeCount ? totalCoefficient / activeCount : 0,
        shortage: allocation.shortage,
        warnings,
        inputSignature: this.signature(c),
        rosterSignature: "",
        updatedAt: new Date().toISOString(),
        updatedBy: actor,
        approvedAt: null,
      };
      await this.repo.update(id, { quotaPolicy: json(policy) }, tx);
      await this.audit.log(
        {
          userId: actor,
          action: "QUOTA_PREVIEWED",
          resource: "term",
          resourceId: id,
          oldValue: previous ?? undefined,
          newValue: policy,
        },
        tx,
      );
      return policy;
    });
  }
  approve(id: string, input: QuotaApproveInput, actor: string) {
    return this.repo.transaction(async (tx) => {
      const c = await this.context(id, tx),
        term = c.term!,
        previous = readQuotaPolicy(term.quotaPolicy);
      V.require(previous, "Cần tính chỉ tiêu đề xuất trước khi chốt.");
      V.revision(previous.revision, input.revision);
      if (
        previous.status !== "DRAFT" ||
        previous.inputSignature !== this.signature(c)
      )
        throw new ConflictException(
          "Dữ liệu đã thay đổi từ lần tính trước. Hãy tính lại chỉ tiêu trước khi chốt.",
        );
      V.require(
        input.members.length === previous.members.length &&
          new Set(input.members.map((m) => m.lecturerId)).size ===
            input.members.length &&
          input.members.every((m) =>
            previous.members.some((p) => p.lecturerId === m.lecturerId),
          ),
        "Phải chốt đầy đủ giảng viên, không trùng hoặc thêm người ngoài đợt.",
      );
      const members = previous.members.map((m) => {
        const final = input.members.find((x) => x.lecturerId === m.lecturerId)!;
        V.require(
          final.quota <= m.maxQuota && final.quota >= m.currentCount,
          `Chỉ tiêu của ${m.name} phải từ ${m.currentCount} đến ${m.maxQuota}.`,
        );
        V.require(
          final.quota === m.suggestedQuota || final.reason.length >= 5,
          `Nhập lý do ít nhất 5 ký tự khi điều chỉnh chỉ tiêu của ${m.name}.`,
        );
        return { ...m, quota: final.quota, reason: final.reason };
      });
      V.require(
        members.reduce((n, m) => n + m.quota, 0) >= previous.demandCount,
        "Tổng chỉ tiêu chưa đủ số sinh viên cần phân. Cần tăng giới hạn hoặc bổ sung giảng viên rồi tính lại.",
      );
      const shortage = this.directions(c, members);
      V.require(
        !shortage,
        `Còn thiếu ${shortage} chỗ đúng hướng chuyên môn. Điều chỉnh chỉ tiêu hoặc chuyên môn trước khi chốt.`,
      );
      const policy: QuotaPolicy = {
        ...previous,
        revision: previous.revision + 1,
        status: "APPROVED",
        members,
        shortage: 0,
        warnings:
          previous.settings.basis === "ROSTER"
            ? [
                "Chuyên môn chỉ được kiểm tra cho đăng ký đã nộp; kiểm tra lại phương án trước khi công bố.",
              ]
            : [],
        rosterSignature: quotaRosterKey(
          term.termStudents.map((s) => s.studentId),
          members,
        ),
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: actor,
      };
      await this.repo.saveQuotas(id, members, tx);
      await this.repo.update(id, { quotaPolicy: json(policy) }, tx);
      await this.audit.log(
        {
          userId: actor,
          action: "QUOTA_APPROVED",
          resource: "term",
          resourceId: id,
          oldValue: previous ?? undefined,
          newValue: policy,
        },
        tx,
      );
      return policy;
    });
  }
}
