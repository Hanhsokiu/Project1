import { ConflictException, Injectable } from "@nestjs/common";
import { CatalogRepository } from "../repository/catalog.repository";
import { CatalogInputValidator } from "../validator/catalog.validator";
import { studentDto, pageDto } from "../mapper/catalog.mapper";
import {
  studentSchema,
  studentPatchSchema,
  type CatalogQuery,
} from "../dto/catalog.dto";
@Injectable()
export class StudentService {
  constructor(private readonly repo: CatalogRepository) {}
  async findAll(q: CatalogQuery) {
    const [items, total] = await this.repo.students(q);
    return pageDto(items.map(studentDto), total, q.page, q.pageSize);
  }
  async detail(id: string) {
    const item = await this.repo.student(id);
    CatalogInputValidator.exists(item, "Không tìm thấy sinh viên");
    return studentDto(item);
  }
  async save(id: string | undefined, raw: unknown, actorId: string) {
    const input = id
      ? CatalogInputValidator.parse(studentPatchSchema, raw)
      : CatalogInputValidator.parse(studentSchema, raw);
    const old = id
      ? await this.repo.student(id)
      : await this.repo.studentByCode(input.studentCode!);
    CatalogInputValidator.exists(
      old,
      "Sinh viên không tồn tại. Vui lòng liên hệ Admin tạo tài khoản sinh viên trước.",
    );
    const [system, emailOwner] = await this.repo.studentReferences(input);
    if (input.trainingSystemId)
      CatalogInputValidator.exists(system, "Hệ đào tạo không tồn tại");
    if (emailOwner && emailOwner.id !== old?.userId)
      throw new ConflictException("Email đã thuộc tài khoản khác");
    if (
      old &&
      input.trainingSystemId &&
      input.trainingSystemId !== old.trainingSystemId
    ) {
      const terms = await this.repo.studentTerms(old.id);
      if (terms.some((t) => t.term.trainingSystemId !== input.trainingSystemId))
        throw new ConflictException(
          "SV đang thuộc đợt khác hệ; cần xử lý danh sách tham gia trước",
        );
    }
    try {
      return studentDto(await this.repo.saveStudent(old.id, input, actorId));
    } catch (error) {
      CatalogInputValidator.duplicate(error);
    }
  }
}
