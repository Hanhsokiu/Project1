import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { TermRepository } from "../../term/repository/term.repository";
import { TermWindowService } from "../../term/service/term-window.service";
import { RegistrationWrite } from "../dto/registration.dto";
import {
  LoadedRegistration,
  RegistrationRepository,
} from "../repository/registration.repository";
import { RegistrationValidator } from "../validator/registration.validator";

export function registrationResponse(row: LoadedRegistration) {
  return {
    id: row.id,
    termId: row.termId,
    studentId: row.studentId,
    directionId: row.directionId,
    note: row.note || "",
    status: row.status === "SUBMITTED" ? "SUBMITTED" : "DRAFT",
    legacyStatus: ["DRAFT", "SUBMITTED"].includes(row.status)
      ? null
      : row.status,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    preferences: row.preferences.map((p) => ({
      lecturerId: p.lecturerId,
      preferenceOrder: p.preferenceOrder,
    })),
  };
}
@Injectable()
export class RegistrationService {
  constructor(
    private readonly repo: RegistrationRepository,
    private readonly terms: TermRepository,
    private readonly windows: TermWindowService,
  ) {}
  current(termId: string, userId: string) {
    return this.repo.transaction(async (tx) => {
      const student = await this.repo.student(userId, tx);
      if (!student)
        throw new ForbiddenException("Tài khoản chưa liên kết sinh viên.");
      RegistrationValidator.contact(student.user, student.phone);
      const term = await this.terms.findById(termId, tx);
      if (!term) throw new NotFoundException("Không tìm thấy đợt.");
      const [row, areas, publication, window] = await Promise.all([
        this.repo.current(termId, student.id, tx),
        this.repo.areas(tx),
        this.terms.publicationState(termId, tx),
        this.windows.getWindow(termId, "REGISTRATION", new Date(), tx),
      ]);
      let eligibilityError: string | null = null;
      try {
        RegistrationValidator.eligibility(student, term);
      } catch (error) {
        eligibilityError = (error as Error).message;
      }
      const lecturers = term.termLecturers.filter((l) => l.lecturer.isActive);
      return {
        registration: row ? registrationResponse(row) : null,
        window: {
          ...window,
          canWrite:
            window.canWrite &&
            !publication.assignmentPublished &&
            !eligibilityError,
          reason: publication.assignmentPublished
            ? "Đã công bố phân công."
            : eligibilityError || window.reason,
        },
        directions: areas.filter((a) =>
          lecturers.some((l) =>
            l.lecturer.researchAreas.some((r) => r.researchAreaId === a.id),
          ),
        ),
        lecturerIds: lecturers.map((l) => l.lecturerId),
      };
    });
  }
  save(
    termId: string,
    userId: string,
    input: RegistrationWrite,
    submit: boolean,
  ) {
    return this.repo.transaction(async (tx) => {
      const student = await this.repo.student(userId, tx);
      if (!student)
        throw new ForbiddenException("Tài khoản chưa liên kết sinh viên.");
      // Contacts in this request cannot bypass onboarding in server data.
      RegistrationValidator.contact(student.user, student.phone);
      const term = await this.terms.findById(termId, tx);
      if (!term) throw new NotFoundException("Không tìm thấy đợt.");
      await this.windows.requireOpen(termId, "REGISTRATION", new Date(), tx);
      if ((await this.terms.publicationState(termId, tx)).assignmentPublished)
        throw new ConflictException(
          "Đã công bố phân công, không thay đổi đăng ký.",
        );
      RegistrationValidator.eligibility(student, term);
      RegistrationValidator.preferences(
        input,
        submit,
        term,
        (await this.repo.areas(tx)).map((a) => a.id),
      );
      const email = input.email ?? student.user.email!;
      const phone = input.phone ?? student.user.phone ?? student.phone!;
      await this.repo.contact(userId, student.id, email, phone, tx);
      const writtenAt = new Date();
      await this.windows.requireOpen(termId, "REGISTRATION", writtenAt, tx);
      const saved = await this.repo.save(
        termId,
        student.id,
        {
          directionId: input.directionId,
          preferences: input.preferences,
          note: input.note,
          status: submit ? "SUBMITTED" : "DRAFT",
          submittedAt: submit ? writtenAt : null,
        },
        tx,
      );
      await this.repo.audit(userId, saved, tx);
      return registrationResponse(saved);
    });
  }
  findByTerm(termId?: string) {
    return this.repo.transaction(async (tx) => {
      if (termId && !(await this.terms.findById(termId, tx)))
        throw new NotFoundException("Không tìm thấy đợt.");
      const rows = (await this.repo.list(termId, tx)).map(registrationResponse);
      return {
        items: rows,
        stats: {
          total: rows.length,
          draft: rows.filter((r) => r.status === "DRAFT").length,
          submitted: rows.filter((r) => r.status === "SUBMITTED").length,
        },
      };
    });
  }
}
