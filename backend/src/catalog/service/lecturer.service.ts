import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { CatalogRepository } from "../repository/catalog.repository";
import { CatalogInputValidator } from "../validator/catalog.validator";
import { lecturerDto, pageDto } from "../mapper/catalog.mapper";
import {
  lecturerSchema,
  lecturerPatchSchema,
  type CatalogQuery,
} from "../dto/catalog.dto";
@Injectable()
export class LecturerService {
  constructor(private readonly repo: CatalogRepository) {}
  async findAll(q: CatalogQuery) {
    const [items, total] = await this.repo.lecturers(q);
    return pageDto(items.map(lecturerDto), total, q.page, q.pageSize);
  }
  async detail(id: string) {
    const item = await this.repo.lecturer(id);
    CatalogInputValidator.exists(item, "Không tìm thấy giảng viên");
    return lecturerDto(item);
  }
  async save(id: string | undefined, raw: unknown, actorId: string) {
    const input = id
      ? CatalogInputValidator.parse(lecturerPatchSchema, raw)
      : CatalogInputValidator.parse(lecturerSchema, raw);
    const old = id ? await this.repo.lecturer(id) : null;
    if (id) CatalogInputValidator.exists(old, "Không tìm thấy giảng viên");
    const [department, title, areas, emailOwner] =
      await this.repo.lecturerReferences(input);
    if (input.departmentId)
      CatalogInputValidator.exists(department, "Bộ môn không tồn tại");
    if (input.titleId)
      CatalogInputValidator.exists(title, "Chức danh không tồn tại");
    if (input.researchAreaIds && areas.length !== input.researchAreaIds.length)
      throw new UnprocessableEntityException("Hướng chuyên môn không tồn tại");
    if (emailOwner && emailOwner.id !== old?.userId)
      throw new ConflictException("Email đã thuộc tài khoản khác");
    if (
      old &&
      input.isActive === false &&
      (await this.repo.lecturerAssignments(old.id))
    )
      throw new ConflictException(
        "GV đang có phân công; không được ngưng hoạt động trước khi xử lý phân công",
      );
    const role = !id ? await this.repo.role("LECTURER") : null;
    if (!id && !role)
      throw new UnprocessableEntityException("Chưa cấu hình vai trò LECTURER");
    try {
      return lecturerDto(
        await this.repo.saveLecturer(
          id,
          input,
          actorId,
          !id ? await bcrypt.hash("Default@2026", 10) : undefined,
          role?.id,
        ),
      );
    } catch (error) {
      CatalogInputValidator.duplicate(error);
    }
  }
}
