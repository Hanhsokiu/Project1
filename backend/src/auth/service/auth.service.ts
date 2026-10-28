import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { createHash, randomUUID } from "crypto";
import { UserAccountRepository } from "../repository/user-account.repository";
import { accountDto } from "../mapper/account.mapper";
import { sealAccountPassword } from "../security/password-vault";
import { AuthValidator } from "../validator/auth.validator";
import { AuditService } from "../../common/audit/audit.service";
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserAccountRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}
  async login(username: string, password: string) {
    const user = await this.users.findByUsername(username);
    if (!user)
      throw new UnauthorizedException("Sai tên đăng nhập hoặc mật khẩu");
    if (user.status !== "ACTIVE")
      throw new UnauthorizedException("Tài khoản đã khóa hoặc chưa kích hoạt");
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      await this.users.failLogin(user.id);
      throw new UnauthorizedException("Sai tên đăng nhập hoặc mật khẩu");
    }
    await this.users.resetFailedLogin(user.id);
    const sid = randomUUID();
    const accessToken = await this.jwt.signAsync({ sub: user.id, sid });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, sid, type: "refresh" },
      {
        secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
        expiresIn: this.config.get("JWT_REFRESH_EXPIRES_IN", "7d"),
      },
    );
    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.users.createSession({
      id: sid,
      userId: user.id,
      refreshToken: await bcrypt.hash(
        createHash("sha256").update(refreshToken).digest("hex"),
        10,
      ),
      expiresAt: new Date(decoded.exp * 1000),
    });
    await this.audit.log({
      userId: user.id,
      action: "AUTH_LOGIN",
      resource: "account",
      resourceId: user.id,
    });
    return { accessToken, refreshToken, user: accountDto(user) };
  }
  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user || user.status !== "ACTIVE") throw new UnauthorizedException();
    return accountDto(user);
  }
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    sid?: string,
  ) {
    const user = await this.users.findById(userId);
    if (!user || !(await bcrypt.compare(oldPassword, user.passwordHash)))
      throw new UnauthorizedException("Mật khẩu hiện tại không đúng");
    AuthValidator.password(oldPassword, newPassword);
    await this.users.updatePassword(
      userId,
      await bcrypt.hash(newPassword, 12),
      sid,
      sealAccountPassword(newPassword),
    );
    return this.me(userId);
  }
  async updateProfile(
    userId: string,
    input: { name: string; email?: string | null; phone?: string },
  ) {
    if (input.email) {
      const other = await this.users.findByEmail(input.email);
      if (other && other.id !== userId)
        throw new ConflictException("Email đã được sử dụng");
    }
    await this.users.updateProfile(userId, input);
    return this.me(userId);
  }
  async refreshToken(token: string) {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        sid: string;
        type: string;
      }>(token, { secret: this.config.getOrThrow("JWT_REFRESH_SECRET") });
      if (payload.type !== "refresh") throw new Error();
      const session = await this.users.session(payload.sid);
      const user = await this.users.findById(payload.sub);
      if (
        !user ||
        user.status !== "ACTIVE" ||
        !session ||
        session.userId !== user.id ||
        session.revokedAt ||
        session.expiresAt < new Date() ||
        !(await bcrypt.compare(
          createHash("sha256").update(token).digest("hex"),
          session.refreshToken,
        ))
      )
        throw new Error();
      return {
        accessToken: await this.jwt.signAsync({
          sub: user.id,
          sid: session.id,
        }),
        user: accountDto(user),
      };
    } catch {
      throw new UnauthorizedException(
        "Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
      );
    }
  }
  async logout(userId: string, sid: string) {
    await this.users.revokeSession(sid, userId);
    await this.audit.log({
      userId,
      action: "AUTH_LOGOUT",
      resource: "account",
      resourceId: userId,
    });
    return { loggedOut: true };
  }
}
