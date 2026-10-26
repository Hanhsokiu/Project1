import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { UserAccountRepository } from "../../auth/repository/user-account.repository";
import { accountDto } from "../../auth/mapper/account.mapper";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { ALLOW_PASSWORD_CHANGE } from "./allow-password-change.decorator";
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UserAccountRepository,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers.authorization;
    let payload: { sub: string; sid: string };
    try {
      if (typeof auth !== "string" || !auth.startsWith("Bearer "))
        throw new Error();
      payload = await this.jwt.verifyAsync(auth.slice(7));
      if (!payload.sub || !payload.sid) throw new Error();
    } catch {
      throw new UnauthorizedException("Token không hợp lệ hoặc đã hết hạn");
    }
    const [user, session] = await Promise.all([
      this.users.findById(payload.sub),
      this.users.session(payload.sid),
    ]);
    if (
      !user ||
      user.status !== "ACTIVE" ||
      !session ||
      session.userId !== user.id ||
      session.revokedAt ||
      session.expiresAt < new Date()
    )
      throw new UnauthorizedException(
        "Phiên đăng nhập đã kết thúc hoặc tài khoản bị khóa",
      );
    if (
      user.mustChangePassword &&
      !this.reflector.getAllAndOverride(ALLOW_PASSWORD_CHANGE, [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      throw new ForbiddenException({
        error: {
          code: "PASSWORD_CHANGE_REQUIRED",
          message:
            "Bạn phải đổi mật khẩu lần đầu trước khi sử dụng chức năng nghiệp vụ",
        },
      });
    req.user = {
      ...accountDto(user),
      sub: user.id,
      userId: user.id,
      sid: session.id,
    };
    return true;
  }
}
