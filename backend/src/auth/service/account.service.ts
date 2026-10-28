import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { UserAccountRepository } from "../repository/user-account.repository";
import { accountDto } from "../mapper/account.mapper";
import {
  openAccountPassword,
  sealAccountPassword,
} from "../security/password-vault";

export interface SaveAccountInput {
  username: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  password?: string;
  roles: string[];
}

@Injectable()
export class AccountService {
  constructor(private readonly users: UserAccountRepository) {}

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

    const plainPassword = data.password?.trim() || "Default@2026";
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    const user = await this.users.createAccount({
      username: data.username.trim(),
      displayName: data.name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      passwordHash,
      passwordCiphertext: sealAccountPassword(plainPassword),
      roles: data.roles,
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

    let passwordHash: string | undefined;
    if (data.password?.trim()) {
      passwordHash = await bcrypt.hash(data.password.trim(), 12);
    }

    const user = await this.users.updateAccount(id, {
      displayName: data.name?.trim(),
      email: data.email !== undefined ? data.email?.trim() || null : undefined,
      phone: data.phone !== undefined ? data.phone?.trim() || null : undefined,
      passwordHash,
      passwordCiphertext: passwordHash
        ? sealAccountPassword(data.password!.trim())
        : undefined,
      roles: data.roles,
      actorId,
    });
    return accountDto(user);
  }

  async revealPassword(id: string, actorId: string) {
    const actor = await this.users.findById(actorId);
    if (!actor?.userRoles.some((link) => link.role.name === "ADMIN"))
      throw new ForbiddenException(
        "Chỉ quản trị viên được xem mật khẩu tài khoản.",
      );
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException("Không tìm thấy tài khoản");
    if (!user.passwordCiphertext) {
      await this.users.recordPasswordView(id, actorId, false);
      return {
        available: false,
        password: null,
        message:
          "Mật khẩu này được lưu trước khi bật kho mã hóa nên chưa thể xem. Có thể xem sau lần đổi hoặc đặt lại mật khẩu tiếp theo.",
      };
    }
    let password: string;
    try {
      password = openAccountPassword(user.passwordCiphertext);
    } catch {
      throw new ServiceUnavailableException(
        "Không mở được kho mật khẩu. Kiểm tra khóa mã hóa trên máy chủ.",
      );
    }
    // Logging must succeed before the credential is returned. Never log the secret.
    await this.users.recordPasswordView(id, actorId, true);
    return { available: true, password, message: "" };
  }

  async resetPassword(id: string, actorId: string) {
    const existing = await this.users.findById(id);
    if (!existing) {
      throw new NotFoundException("Không tìm thấy tài khoản");
    }
    const defaultPassword = existing.student?.studentCode || "Default@2026";
    const passwordHash = await bcrypt.hash(defaultPassword, 12);
    const user = await this.users.resetPassword(
      id,
      passwordHash,
      actorId,
      sealAccountPassword(defaultPassword),
    );
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
