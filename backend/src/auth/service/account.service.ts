import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { z } from "zod";
import { UserAccountRepository } from "../repository/user-account.repository";
import { accountDto } from "../mapper/account.mapper";

export interface SaveAccountInput {
  username: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  password?: string;
  roles: string[];
  trainingSystemId?: string;
  majorName?: string;
  className?: string;
  departmentId?: string;
  researchAreaIds?: string[];
  maxStudents?: number;
}

@Injectable()
export class AccountService {
  constructor(private readonly users: UserAccountRepository) {}
  private studentClass(roles: string[], value: unknown) {
    if (value === undefined) return undefined;
    if (
      !roles.includes("STUDENT") ||
      !z.string().trim().min(1).max(100).safeParse(value).success
    )
      throw new BadRequestException(
        "Lớp chỉ dành cho sinh viên, từ 1 đến 100 ký tự.",
      );
    return (value as string).trim();
  }
  private async lecturerProfile(
    roles: string[],
    data: Partial<SaveAccountInput>,
    current?: {
      departmentId: string;
      maxStudents: number;
      researchAreas: { researchAreaId: string }[];
    } | null,
  ) {
    if (!roles.includes("LECTURER")) {
      if (
        data.departmentId !== undefined ||
        data.researchAreaIds !== undefined ||
        data.maxStudents !== undefined
      )
        throw new BadRequestException(
          "Thông tin hướng dẫn chỉ dành cho tài khoản giảng viên.",
        );
      return {};
    }
    const departmentId = data.departmentId ?? current?.departmentId;
    const ids =
      data.researchAreaIds ??
      current?.researchAreas.map((a) => a.researchAreaId);
    const maxStudents = data.maxStudents ?? current?.maxStudents ?? 5;
    if (
      !z.string().uuid().safeParse(departmentId).success ||
      !departmentId ||
      !(await this.users.department(departmentId))
    )
      throw new BadRequestException(
        "Vui lòng chọn bộ môn hợp lệ cho giảng viên.",
      );
    if (
      !z.array(z.string().uuid()).min(1).max(100).safeParse(ids).success ||
      !ids ||
      new Set(ids).size !== ids.length
    )
      throw new BadRequestException(
        "Chọn ít nhất một hướng chuyên môn, không trùng lặp.",
      );
    if ((await this.users.researchAreas(ids)).length !== ids.length)
      throw new BadRequestException("Hướng chuyên môn không tồn tại.");
    if (!Number.isInteger(maxStudents) || maxStudents < 0 || maxStudents > 100)
      throw new BadRequestException(
        "Số sinh viên hướng dẫn tối đa phải là số nguyên từ 0 đến 100.",
      );
    return { departmentId, researchAreaIds: ids, maxStudents };
  }
  private studentMajor(roles: string[], value: unknown) {
    if (value === undefined) return undefined;
    if (
      !roles.includes("STUDENT") ||
      !z.string().trim().min(1).max(200).safeParse(value).success
    )
      throw new BadRequestException(
        "Ngành học chỉ dành cho sinh viên, từ 1 đến 200 ký tự.",
      );
    return (value as string).trim();
  }
  private async studentTrainingSystem(
    roles: string[],
    id?: string,
    currentId?: string,
  ) {
    if (!roles.includes("STUDENT")) return undefined;
    const selected = id ?? currentId;
    if (!selected || !z.string().uuid().safeParse(selected).success)
      throw new BadRequestException(
        "Vui lòng chọn hệ đào tạo cho tài khoản sinh viên.",
      );
    if (!(await this.users.trainingSystem(selected)))
      throw new BadRequestException("Hệ đào tạo không tồn tại.");
    return selected;
  }

  async findAll(params: { page: number; limit: number; search?: string }) {
    const [items, total] = await this.users.list(
      params.page,
      params.limit,
      params.search,
    );
    return {
      items: items.map(accountDto),
      total,
      page: params.page,
      pageSize: params.limit,
    };
  }

  async create(data: SaveAccountInput, actorId: string) {
    if (!data.username || data.username.trim().length < 3) {
      throw new BadRequestException("Tên đăng nhập ít nhất 3 ký tự");
    }
    if (!data.name || data.name.trim().length < 2) {
      throw new BadRequestException("Họ và tên ít nhất 2 ký tự");
    }
    if (!data.roles || !data.roles.length) {
      throw new BadRequestException("Phải chọn ít nhất một vai trò");
    }

    const existing = await this.users.findByUsername(data.username.trim());
    if (existing) {
      throw new ConflictException("Tên đăng nhập đã tồn tại");
    }
    if (data.email?.trim()) {
      const existingEmail = await this.users.findByEmail(data.email.trim());
      if (existingEmail) {
        throw new ConflictException("Email đã được sử dụng");
      }
    }

    const trainingSystemId = await this.studentTrainingSystem(
      data.roles,
      data.trainingSystemId,
    );
    const plainPassword = data.password?.trim() || "Default@2026";
    const lecturer = await this.lecturerProfile(data.roles, data);
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    const user = await this.users.createAccount({
      username: data.username.trim(),
      displayName: data.name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      passwordHash,
      roles: data.roles,
      trainingSystemId,
      majorName: this.studentMajor(data.roles, data.majorName),
      className: this.studentClass(data.roles, data.className),
      ...lecturer,
      actorId,
    });
    return accountDto(user);
  }

  async update(id: string, data: Partial<SaveAccountInput>, actorId: string) {
    const existing = await this.users.findById(id);
    if (!existing) {
      throw new NotFoundException("Không tìm thấy tài khoản");
    }
    if (data.email?.trim() && data.email.trim() !== existing.email) {
      const existingEmail = await this.users.findByEmail(data.email.trim());
      if (existingEmail && existingEmail.id !== id) {
        throw new ConflictException("Email đã được sử dụng");
      }
    }

    const trainingSystemId = await this.studentTrainingSystem(
      data.roles ?? existing.userRoles.map((r) => r.role.name),
      data.trainingSystemId,
      existing.student?.trainingSystemId,
    );
    let passwordHash: string | undefined;
    const lecturer = await this.lecturerProfile(
      data.roles ?? existing.userRoles.map((r) => r.role.name),
      data,
      existing.lecturer,
    );
    if (data.password?.trim()) {
      passwordHash = await bcrypt.hash(data.password.trim(), 12);
    }

    const user = await this.users.updateAccount(id, {
      displayName: data.name?.trim(),
      email: data.email !== undefined ? data.email?.trim() || null : undefined,
      phone: data.phone !== undefined ? data.phone?.trim() || null : undefined,
      passwordHash,
      roles: data.roles,
      trainingSystemId,
      majorName: this.studentMajor(
        data.roles ?? existing.userRoles.map((r) => r.role.name),
        data.majorName,
      ),
      className: this.studentClass(
        data.roles ?? existing.userRoles.map((r) => r.role.name),
        data.className,
      ),
      ...lecturer,
      actorId,
    });
    return accountDto(user);
  }

  async resetPassword(id: string, actorId: string) {
    const existing = await this.users.findById(id);
    if (!existing) {
      throw new NotFoundException("Không tìm thấy tài khoản");
    }
    const defaultPassword = existing.student?.studentCode || "Default@2026";
    const passwordHash = await bcrypt.hash(defaultPassword, 12);
    const user = await this.users.resetPassword(id, passwordHash, actorId);
    return accountDto(user);
  }

  async toggleLock(id: string, actorId: string) {
    const existing = await this.users.findById(id);
    if (!existing) {
      throw new NotFoundException("Không tìm thấy tài khoản");
    }
    if (id === actorId) {
      throw new BadRequestException("Không thể tự khóa tài khoản đang sử dụng");
    }
    const newStatus = existing.status === "LOCKED" ? "ACTIVE" : "LOCKED";
    const user = await this.users.setStatus(id, newStatus);
    return accountDto(user);
  }
}
