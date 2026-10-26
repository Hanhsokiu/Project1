import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import { RegistrationService } from "../service/registration.service";
import { ApiResponse } from "../../common/dto/api-response.dto";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { CurrentUser } from "../../common/security/current-user.decorator";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import {
  RegistrationWrite,
  RegistrationWriteSchema,
} from "../dto/registration.dto";

const requestSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    directionId: { type: "string", format: "uuid", nullable: true },
    preferences: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        required: ["lecturerId", "preferenceOrder"],
        properties: {
          lecturerId: { type: "string", format: "uuid" },
          preferenceOrder: { type: "integer", minimum: 1, maximum: 3 },
        },
      },
    },
    note: { type: "string", maxLength: 3000 },
    email: { type: "string", format: "email" },
    phone: { type: "string", pattern: "^(0|\\+84)[0-9]{9,10}$" },
  },
};

@ApiTags("registration")
@ApiBearerAuth()
@Controller("registrations")
export class RegistrationController {
  constructor(private readonly regService: RegistrationService) {}
  @Get()
  @RequirePermission("registration", "read")
  async all() {
    return ApiResponse.ok(await this.regService.findByTerm());
  }

  @Get("term/:termId")
  @RequirePermission("registration", "read")
  @ApiOperation({ summary: "UC09: Danh sách đăng ký theo đợt" })
  async getByTerm(@Param("termId", ParseUUIDPipe) termId: string) {
    const list = await this.regService.findByTerm(termId);
    return ApiResponse.ok(list);
  }
  @Get("term/:termId/me")
  @RequirePermission("registration", "own")
  @ApiOperation({
    summary: "Đăng ký chính chủ, hướng áp dụng và cửa sổ server",
  })
  async current(
    @Param("termId", ParseUUIDPipe) termId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return ApiResponse.ok(await this.regService.current(termId, user.sub));
  }
  @Put("term/:termId/me/draft")
  @RequirePermission("registration", "own")
  @ApiBody({ schema: requestSchema })
  async draft(
    @Param("termId", ParseUUIDPipe) termId: string,
    @CurrentUser() user: { sub: string },
    @Body(new ZodValidationPipe(RegistrationWriteSchema))
    body: RegistrationWrite,
  ) {
    return ApiResponse.ok(
      await this.regService.save(termId, user.sub, body, false),
    );
  }
  @Post("term/:termId/me/submit")
  @RequirePermission("registration", "own")
  @ApiBody({ schema: requestSchema })
  async submit(
    @Param("termId", ParseUUIDPipe) termId: string,
    @CurrentUser() user: { sub: string },
    @Body(new ZodValidationPipe(RegistrationWriteSchema))
    body: RegistrationWrite,
  ) {
    return ApiResponse.ok(
      await this.regService.save(termId, user.sub, body, true),
    );
  }
}
