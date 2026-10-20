import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserAccountRepository } from '../repository/user-account.repository';
import * as bcrypt from 'bcryptjs';
import { BusinessException } from '../../common/exception/business.exception';
import { ErrorCode } from '../../common/exception/error-code.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserAccountRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.userRepo.findByUsername(username);
    if (!user) throw new BusinessException(ErrorCode.INVALID_CREDENTIALS, 'Sai tên đăng nhập hoặc mật khẩu');

    if (user.status === 'LOCKED') {
      throw new BusinessException(ErrorCode.ACCOUNT_LOCKED, 'Tài khoản đã bị khóa');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      // TODO: Tăng failedLoginCount, khóa sau 5 lần
      throw new BusinessException(ErrorCode.INVALID_CREDENTIALS, 'Sai tên đăng nhập hoặc mật khẩu');
    }

    const roles = user.userRoles?.map((ur) => ur.role.name) || [];
    const payload = { sub: user.id, username: user.username, roles };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 'Không tìm thấy tài khoản');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new BusinessException(ErrorCode.INVALID_CREDENTIALS, 'Mật khẩu cũ không chính xác');
    }

    const { valid, errors } = PasswordPolicyValidator.validate(newPassword);
    if (!valid) {
      throw new BusinessException(
        ErrorCode.PASSWORD_POLICY_VIOLATED,
        errors.join(', '),
      );
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.updatePassword(userId, newHash);

    return { success: true, message: 'Đổi mật khẩu thành công' };
  }

  async refreshToken(refreshToken: string) {
    // TODO: Implement refresh token logic
    throw new UnauthorizedException('Not implemented');
  }

  async logout(refreshToken: string) {
    // TODO: Revoke session
    return { success: true };
  }
}
