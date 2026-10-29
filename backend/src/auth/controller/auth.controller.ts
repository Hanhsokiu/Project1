import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthService } from "../service/auth.service";
import { Public } from "../../common/security/public.decorator";
import { CurrentUser } from "../../common/security/current-user.decorator";
import { AllowPasswordChange } from "../../common/security/allow-password-change.decorator";
import { ApiResponse } from "../../common/dto/api-response.dto";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import {
  LoginSchema,
  ChangePasswordSchema,
  RefreshSchema,
  ProfileSchema,
} from "../dto/auth.dto";
import type { accountDto } from "../mapper/account.mapper";
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @Post("login")
  @ApiOperation({ summary: "Đăng nhập, trả tài khoản an toàn và phiên JWT" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["username", "password"],
      properties: {
        username: { type: "string" },
        password: { type: "string", format: "password" },
      },
    },
  })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) body: z.infer<typeof LoginSchema>,
  ) {
    return ApiResponse.ok(await this.auth.login(body.username, body.password));
  }
  @AllowPasswordChange() @ApiBearerAuth() @Get("me") async me(
    @CurrentUser() user: ReturnType<typeof accountDto> & {
      sub: string; userId: string; sid: string;
    },
  ) {
    // JwtAuthGuard has already loaded and validated this identity for this request.
    const { sub: _sub, userId: _userId, sid: _sid, ...account } = user;
    return ApiResponse.ok(account);
  }
  @AllowPasswordChange()
  @ApiBearerAuth()
  @Post("change-password")
  async password(
    @CurrentUser() user: { sub: string; sid: string },
    @Body(new ZodValidationPipe(ChangePasswordSchema))
    body: z.infer<typeof ChangePasswordSchema>,
  ) {
    return ApiResponse.ok(
      await this.auth.changePassword(
        user.sub,
        body.oldPassword,
        body.newPassword,
        user.sid,
      ),
    );
  }
  @ApiBearerAuth() @Patch("profile") async profile(
    @CurrentUser() user: { sub: string },
    @Body(new ZodValidationPipe(ProfileSchema))
    body: z.infer<typeof ProfileSchema>,
  ) {
    return ApiResponse.ok(await this.auth.updateProfile(user.sub, body));
  }
  @Public() @Post("refresh") async refresh(
    @Body(new ZodValidationPipe(RefreshSchema))
    body: z.infer<typeof RefreshSchema>,
  ) {
    return ApiResponse.ok(await this.auth.refreshToken(body.refreshToken));
  }
  @AllowPasswordChange() @ApiBearerAuth() @Post("logout") async logout(
    @CurrentUser() user: { sub: string; sid: string },
  ) {
    return ApiResponse.ok(await this.auth.logout(user.sub, user.sid));
  }
}
