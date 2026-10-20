import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from '../service/auth.service';
import { Public } from '../../common/security/public.decorator';
import { CurrentUser } from '../../common/security/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * UC01: Đăng nhập
   */
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'UC01: Đăng nhập hệ thống' })
  async login(@Body() body: { username: string; password: string }) {
    return this.authService.login(body.username, body.password);
  }

  /**
   * UC01: Đổi mật khẩu (lần đầu hoặc định kỳ)
   */
  @Post('change-password')
  @ApiOperation({ summary: 'UC01: Đổi mật khẩu' })
  async changePassword(
    @CurrentUser() user: { sub: string },
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(user.sub, body.oldPassword, body.newPassword);
  }

  /**
   * UC01: Làm mới token
   */
  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Làm mới token' })
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  /**
   * UC01: Đăng xuất
   */
  @Post('logout')
  @ApiOperation({ summary: 'Đăng xuất khỏi hệ thống' })
  async logout(@Body() body: { refreshToken: string }) {
    return this.authService.logout(body.refreshToken);
  }
}
