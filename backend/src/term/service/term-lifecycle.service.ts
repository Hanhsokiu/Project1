import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { TermStatus } from "@prisma/client";
import { AuditService } from "../../common/audit/audit.service";
import { ErrorCode } from "../../common/exception/error-code.enum";
import {
  PhaseInput,
  RosterDto,
  SemesterCreateDto,
  TermCreateDto,
  TermPatchDto,
  TermQueryDto,
} from "../dto/term.dto";
import {
  parametersFromTerm,
  phasesFromTerm,
  toTermResponse,
} from "../dto/term.mapper";
import {
  LoadedTerm,
  TermRepository,
  TermTransaction,
} from "../repository/term.repository";
import {
  defaultPhasePlan,
  defaultTermParameters,
  hasPassingGpa,
  termAssert,
  validateAcademicYear,
  validateDateRange,
  validateParameters,
  validatePhasePlan,
} from "../validator/term-configuration.validator";
import { TermTransitionValidator } from "../validator/term-transition.validator";

@Injectable()
export class TermLifecycleService {
  constructor(
    private readonly repository: TermRepository,
    private readonly validator: TermTransitionValidator,
    private readonly audit: AuditService,
  ) {}
  private async required(id: string, tx?: TermTransaction) {
    const term = await this.repository.findById(id, tx);
    if (!term) throw new NotFoundException("Không tìm thấy đợt đồ án.");
    return term;
  }
  private editable(term: LoadedTerm) {
    termAssert(
      !term.isLocked,
      "Đợt đã khóa.",
      ErrorCode.TERM_LOCKED,
      HttpStatus.CONFLICT,
    );
    termAssert(
      !["COMPLETED", "CANCELLED"].includes(term.status),
      "Đợt đã hoàn thành hoặc hủy, không được cập nhật.",
      ErrorCode.TERM_LOCKED,
      HttpStatus.CONFLICT,
    );
  }
  private async response(term: LoadedTerm, tx?: TermTransaction) {
    return toTermResponse(
      term,
      await this.repository.publicationState(term.id, tx),
    );
  }
  async findAll(query: TermQueryDto) {
    const result = await this.repository.list(query);
    return {
      items: await Promise.all(result.items.map((term) => this.response(term))),
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(result.total / query.pageSize),
    };
  }
  async findById(id: string) {
    return this.response(await this.required(id));
  }
  async latest(trainingSystemId: string, semesterId: string) {
    const term = await this.repository.latest(trainingSystemId, semesterId);
    if (!term)
      throw new NotFoundException("Không có đợt cho hệ và kỳ học đã chọn.");
    return this.response(term);
  }
  semesters(query: { academicYear?: string; search?: string }) {
    return this.repository.semesters(query);
  }
  async createSemester(input: SemesterCreateDto, userId: string) {
    validateAcademicYear(input.academicYear);
    const start = new Date(input.startDate),
      end = new Date(input.endDate);
    validateDateRange(start, end, "Kỳ học");
    return this.repository.transaction(async (tx) => {
      termAssert(
        !(await this.repository.semesterByKey(
          input.academicYear,
          input.semester,
          tx,
        )),
        "Kỳ học đã tồn tại trong năm học.",
        ErrorCode.DUPLICATE,
        HttpStatus.CONFLICT,
      );
      const semester = await this.repository.createSemester(
        {
          ...input,
          name:
            input.name ?? `${input.academicYear} / Học kỳ ${input.semester}`,
          startDate: start,
          endDate: end,
        },
        tx,
      );
      await this.audit.log(
        {
          userId,
          action: "CREATE_SEMESTER",
          resource: "term",
          resourceId: semester.id,
          newValue: {
            ...semester,
            startDate: semester.startDate.toISOString(),
            endDate: semester.endDate.toISOString(),
            createdAt: semester.createdAt.toISOString(),
            updatedAt: semester.updatedAt.toISOString(),
          },
        },
        tx,
      );
      return semester;
    });
  }
  async create(input: TermCreateDto, userId: string) {
    return this.repository.transaction(async (tx) => {
      const semester = await this.repository.semester(input.semesterId, tx),
        program = await this.repository.trainingSystem(
          input.trainingSystemId,
          tx,
        );
      termAssert(semester && program, "Kỳ học hoặc hệ đào tạo không tồn tại.");
      const start = new Date(input.startDate),
        end = new Date(input.endDate);
      validateDateRange(start, end, "Đợt đồ án");
      termAssert(
        start >= semester.startDate && end <= semester.endDate,
        "Thời gian đợt phải nằm trong kỳ học đã chọn.",
      );
      const code = input.code.toUpperCase();
      termAssert(
        !(await this.repository.findByCode(code, tx)),
        "Mã đợt đã tồn tại.",
        ErrorCode.DUPLICATE,
        HttpStatus.CONFLICT,
      );
      const phases = defaultPhasePlan(
        start,
        end,
        input.registrationStart,
        input.registrationEnd,
      );
      const term = await this.repository.create(
        {
          code,
          name: input.name,
          academicYear: semester.academicYear,
          semester: semester.semester,
          startDate: start,
          endDate: end,
          semesterRecord: { connect: { id: semester.id } },
          trainingSystem: { connect: { id: program.id } },
          phases: {
            create: phases.map((p) => ({
              code: p.code,
              phaseName: p.name,
              startDate: new Date(p.start),
              endDate: new Date(p.end),
              isLocked: p.locked,
            })),
          },
          parameters: {
            create: Object.entries(defaultTermParameters).map(
              ([key, value]) => ({ key, value: String(value) }),
            ),
          },
        },
        tx,
      );
      const response = await this.response(term, tx);
      await this.audit.log(
        {
          userId,
          action: "CREATE_TERM",
          resource: "term",
          resourceId: term.id,
          newValue: response,
        },
        tx,
      );
      return response;
    });
  }
  async update(id: string, input: TermPatchDto, userId: string) {
    return this.repository.transaction(async (tx) => {
      const term = await this.required(id, tx);
      this.editable(term);
      const before = await this.response(term, tx);
      const semester = await this.repository.semester(
          input.semesterId ?? term.semesterId ?? "",
          tx,
        ),
        program = await this.repository.trainingSystem(
          input.trainingSystemId ?? term.trainingSystemId ?? "",
          tx,
        );
      termAssert(semester && program, "Cần chọn kỳ học và hệ đào tạo hợp lệ.");
      if (
        input.trainingSystemId &&
        input.trainingSystemId !== term.trainingSystemId
      )
        termAssert(
          !term.termStudents.length,
          "Không đổi hệ đào tạo khi đợt đã có sinh viên.",
        );
      const start = input.startDate
          ? new Date(input.startDate)
          : term.startDate,
        end = input.endDate ? new Date(input.endDate) : term.endDate;
      validateDateRange(start, end, "Đợt đồ án");
      termAssert(
        start >= semester.startDate && end <= semester.endDate,
        "Thời gian đợt phải nằm trong kỳ học.",
      );
      const code = (input.code ?? term.code).toUpperCase();
      const duplicate = await this.repository.findByCode(code, tx);
      termAssert(
        !duplicate || duplicate.id === id,
        "Mã đợt đã tồn tại.",
        ErrorCode.DUPLICATE,
        HttpStatus.CONFLICT,
      );
      const phases = phasesFromTerm(term).map((p) => ({
        id: p.id,
        code: p.code,
        name: p.phaseName,
        start: p.startDate.toISOString(),
        end: p.endDate.toISOString(),
        locked: p.isLocked,
      }));
      const registration = phases.find((p) => p.code === "REGISTRATION");
      const registrationChanged =
        !!registration &&
        ((!!input.registrationStart &&
          new Date(input.registrationStart).getTime() !==
            new Date(registration.start).getTime()) ||
          (!!input.registrationEnd &&
            new Date(input.registrationEnd).getTime() !==
              new Date(registration.end).getTime()));
      if (input.registrationStart || input.registrationEnd) {
        termAssert(registration, "Chưa cấu hình giai đoạn đăng ký.");
        if (input.registrationStart)
          registration.start = input.registrationStart;
        if (input.registrationEnd) registration.end = input.registrationEnd;
      }
      validatePhasePlan(phases, start, end);
      if (registration && registrationChanged) {
        termAssert(
          term.status === "DRAFT" || term.status === "OPEN_REGISTRATION",
          "Chỉ sửa cửa sổ đăng ký trước khi đóng đăng ký.",
        );
        await this.repository.updatePhase(
          registration.id!,
          {
            startDate: new Date(registration.start),
            endDate: new Date(registration.end),
          },
          tx,
        );
      }
      const updated = await this.repository.update(
        id,
        {
          code,
          name: input.name ?? term.name,
          startDate: start,
          endDate: end,
          academicYear: semester.academicYear,
          semester: semester.semester,
          semesterRecord: { connect: { id: semester.id } },
          trainingSystem: { connect: { id: program.id } },
        },
        tx,
      );
      const response = await this.response(updated, tx);
      await this.audit.log(
        {
          userId,
          action: "UPDATE_TERM",
          resource: "term",
          resourceId: id,
          oldValue: before,
          newValue: response,
        },
        tx,
      );
      return response;
    });
  }
  async transition(id: string, status: TermStatus, userId: string) {
    return this.repository.transaction(async (tx) => {
      const term = await this.required(id, tx);
      this.editable(term);
      const before = await this.response(term, tx);
      termAssert(
        this.validator.canTransition(term.status, status),
        "Chuyển trạng thái đợt không hợp lệ.",
        ErrorCode.TERM_TRANSITION_INVALID,
        HttpStatus.CONFLICT,
      );
      const state = await this.repository.publicationState(id, tx);
      if (status === "OPEN_REGISTRATION") {
        termAssert(
          !state.assignmentPublished,
          "Không mở lại đăng ký sau khi đã có phân công chính thức.",
          ErrorCode.TERM_TRANSITION_INVALID,
          HttpStatus.CONFLICT,
        );
        termAssert(
          term.termStudents.length > 0 &&
            term.termLecturers.some((l) => l.quota > 0),
          "Cần danh sách sinh viên đủ điều kiện và giảng viên có quota trước khi mở đăng ký.",
        );
        validatePhasePlan(
          phasesFromTerm(term).map((p) => ({
            id: p.id,
            code: p.code,
            name: p.phaseName,
            start: p.startDate.toISOString(),
            end: p.endDate.toISOString(),
            locked: p.isLocked,
          })),
          term.startDate,
          term.endDate,
        );
        const parameters = parametersFromTerm(term);
        validateParameters(parameters);
        const registration = phasesFromTerm(term).find(
          (p) => p.code === "REGISTRATION",
        );
        termAssert(
          registration &&
            !registration.isLocked &&
            registration.endDate > new Date(),
          "Giai đoạn đăng ký đã khóa hoặc đã hết hạn.",
        );
        for (const entry of term.termStudents)
          termAssert(
            entry.student.isActive &&
              entry.student.academicEligible &&
              hasPassingGpa(
                entry.student.gpa,
                parameters.passing_gpa_threshold,
              ) &&
              entry.student.trainingSystemId === term.trainingSystemId,
            "Danh sách có sinh viên không còn đủ điều kiện học vụ/hệ đào tạo.",
          );
        termAssert(
          term.termLecturers.every(
            (l) => l.lecturer.isActive && l.lecturer.researchAreas.length > 0,
          ),
          "Giảng viên tham gia cần hoạt động và có hướng chuyên môn.",
        );
      }
      if (status === "IN_PROGRESS")
        termAssert(
          state.assignmentPublished,
          "Cần công bố phân công chính thức trước khi thực hiện.",
        );
      if (status === "COMPLETED")
        termAssert(state.resultsPublished, "Chưa có kết quả được công bố.");
      const updated = await this.repository.update(id, { status }, tx);
      const response = await this.response(updated, tx);
      await this.audit.log(
        {
          userId,
          action: "TRANSITION_TERM",
          resource: "term",
          resourceId: id,
          oldValue: before,
          newValue: response,
        },
        tx,
      );
      return response;
    });
  }
  async lock(id: string, locked: boolean, userId: string) {
    return this.repository.transaction(async (tx) => {
      const term = await this.required(id, tx);
      termAssert(term.isLocked !== locked, "Trạng thái khóa không thay đổi.");
      const before = await this.response(term, tx);
      const updated = await this.repository.update(
        id,
        { isLocked: locked },
        tx,
      );
      const response = await this.response(updated, tx);
      await this.audit.log(
        {
          userId,
          action: locked ? "LOCK_TERM" : "UNLOCK_TERM",
          resource: "term",
          resourceId: id,
          oldValue: before,
          newValue: response,
        },
        tx,
      );
      return response;
    });
  }
  async savePhases(id: string, phases: PhaseInput[], userId: string) {
    return this.repository.transaction(async (tx) => {
      const term = await this.required(id, tx);
      this.editable(term);
      const before = await this.response(term, tx);
      validatePhasePlan(phases, term.startDate, term.endDate);
      const existing = phasesFromTerm(term);
      termAssert(
        phases.every(
          (p) =>
            !p.id ||
            existing.some((old) => old.id === p.id && old.code === p.code),
        ),
        "Mã giai đoạn không thuộc đợt hoặc không khớp loại giai đoạn.",
      );
      for (const phase of phases) {
        const old = existing.find((p) => p.code === phase.code);
        const data = {
          phaseName: phase.name,
          code: phase.code,
          startDate: new Date(phase.start),
          endDate: new Date(phase.end),
          isLocked: phase.locked,
        };
        if (old) await this.repository.updatePhase(old.id, data, tx);
        else await this.repository.createPhase({ termId: id, ...data }, tx);
      }
      const response = await this.response(await this.required(id, tx), tx);
      await this.audit.log(
        {
          userId,
          action: "SAVE_TERM_PHASES",
          resource: "term",
          resourceId: id,
          oldValue: before,
          newValue: response,
        },
        tx,
      );
      return response;
    });
  }
  async saveParameters(
    id: string,
    parameters: Record<string, number>,
    userId: string,
  ) {
    return this.repository.transaction(async (tx) => {
      const term = await this.required(id, tx);
      this.editable(term);
      const state = await this.repository.publicationState(id, tx);
      termAssert(
        !state.resultsPublished,
        "Không đổi tham số sau khi công bố kết quả.",
      );
      const before = parametersFromTerm(term),
        values = { ...before, ...parameters };
      validateParameters(values);
      termAssert(
        term.termStudents.every((s) =>
          hasPassingGpa(s.student.gpa, values.passing_gpa_threshold),
        ),
        "Ngưỡng GPA mới cao hơn GPA của sinh viên trong danh sách.",
      );
      await this.repository.replaceParameters(id, values, tx);
      await this.audit.log(
        {
          userId,
          action: "SAVE_TERM_PARAMETERS",
          resource: "term",
          resourceId: id,
          oldValue: before,
          newValue: values,
        },
        tx,
      );
      return this.response(await this.required(id, tx), tx);
    });
  }
  async saveRoster(id: string, input: RosterDto, userId: string) {
    return this.repository.transaction(async (tx) => {
      const term = await this.required(id, tx);
      this.editable(term);
      const before = await this.response(term, tx),
        parameters = parametersFromTerm(term);
      termAssert(
        new Set(input.studentIds).size === input.studentIds.length &&
          new Set(input.lecturers.map((l) => l.lecturerId)).size ===
            input.lecturers.length,
        "Danh sách sinh viên và giảng viên không được trùng.",
      );
      termAssert(
        input.lecturers.every(
          (l) => Number.isInteger(l.quota) && l.quota >= 0 && l.quota <= 500,
        ),
        "Quota phải là số nguyên từ 0 đến 500.",
      );
      const students = await this.repository.students(input.studentIds, tx),
        lecturers = await this.repository.lecturers(
          input.lecturers.map((l) => l.lecturerId),
          tx,
        );
      termAssert(
        students.length === input.studentIds.length &&
          lecturers.length === input.lecturers.length,
        "Có sinh viên/giảng viên không tồn tại.",
      );
      termAssert(
        students.every(
          (s) =>
            s.isActive &&
            s.academicEligible &&
            hasPassingGpa(s.gpa, parameters.passing_gpa_threshold) &&
            s.trainingSystemId === term.trainingSystemId,
        ),
        "Sinh viên phải hoạt động, đúng hệ và đủ điều kiện học vụ/GPA.",
      );
      termAssert(
        lecturers.every((l) => l.isActive && l.researchAreas.length > 0),
        "Giảng viên tham gia phải hoạt động và có hướng chuyên môn.",
      );
      const state = await this.repository.publicationState(id, tx);
      for (const assignment of state.officialAssignments) {
        termAssert(
          input.studentIds.includes(assignment.registration.studentId),
          "Không loại sinh viên đã có phân công chính thức.",
        );
        const member = input.lecturers.find(
          (l) => l.lecturerId === assignment.advisorId,
        );
        termAssert(
          member,
          "Không loại giảng viên đang có phân công chính thức.",
        );
        termAssert(
          member.quota >=
            state.officialAssignments.filter(
              (a) => a.advisorId === member.lecturerId,
            ).length,
          "Quota thấp hơn số sinh viên được phân công chính thức.",
          ErrorCode.QUOTA_EXCEEDED,
          HttpStatus.CONFLICT,
        );
      }
      const registrations = await this.repository.registrations(id, tx);
      termAssert(
        registrations
          .filter((r) => r.status !== "CANCELLED" && r.status !== "REJECTED")
          .every((r) => input.studentIds.includes(r.studentId)),
        "Không loại sinh viên đã có đăng ký còn hiệu lực.",
      );
      await this.repository.replaceRoster(id, input, tx);
      const response = await this.response(await this.required(id, tx), tx);
      await this.audit.log(
        {
          userId,
          action: "SAVE_TERM_ROSTER",
          resource: "term",
          resourceId: id,
          oldValue: before,
          newValue: response,
        },
        tx,
      );
      return response;
    });
  }
}
