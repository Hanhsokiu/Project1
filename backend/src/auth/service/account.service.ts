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
}

@Injectable()
export class AccountService {
  constructor(private readonly users: UserAccountRepository) {}
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
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    const user = await this.users.createAccount({
      username: data.username.trim(),
      displayName: data.name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      passwordHash,
      roles: data.roles,
      trainingSystemId,
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
