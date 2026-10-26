import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AssignmentPlanService } from "../service/assignment-plan.service";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { CurrentUser } from "../../common/security/current-user.decorator";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import { ApiResponse } from "../../common/dto/api-response.dto";
const run = z
  .object({
    mode: z.enum(["remaining", "all"]).default("remaining"),
    confirmed: z.boolean().default(false),
    revision: z.number().int().min(0),
    inputHash: z.string().optional(),
  })
  .strict();
const adjust = z
  .object({
    studentId: z.string().uuid(),
    lecturerId: z.string().uuid(),
    reason: z.string().trim().min(10).max(3000),
    revision: z.number().int().min(1),
  })
  .strict();
const revision = z.object({ revision: z.number().int().min(1) }).strict();
@ApiTags("assignment")
@ApiBearerAuth()
@Controller("assignments/term/:termId")
export class AssignmentController {
  constructor(private readonly service: AssignmentPlanService) {}
  @Get("plan")
  @RequirePermission("assignment", "manage")
  async plan(
    @Param("termId", ParseUUIDPipe) id: string,
    @CurrentUser() u: { sub: string },
  ) {
    return ApiResponse.ok(await this.service.view(id, u.sub, true));
  }
  @Get("results")
  @RequirePermission("assignment", "read")
  async results(
    @Param("termId", ParseUUIDPipe) id: string,
    @CurrentUser() u: { sub: string },
  ) {
    return ApiResponse.ok(await this.service.view(id, u.sub));
  }
  @Post("preview")
  @RequirePermission("assignment", "manage")
  async preview(
    @Param("termId", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(run)) b: z.infer<typeof run>,
  ) {
    return ApiResponse.ok(await this.service.preview(id, b));
  }
  @Put("draft")
  @RequirePermission("assignment", "manage")
  async save(
    @Param("termId", ParseUUIDPipe) id: string,
    @CurrentUser() u: { sub: string },
    @Body(new ZodValidationPipe(run)) b: z.infer<typeof run>,
  ) {
    return ApiResponse.ok(await this.service.save(id, b, u.sub));
  }
  @Put("manual")
  @RequirePermission("assignment", "manage")
  async adjust(
    @Param("termId", ParseUUIDPipe) id: string,
    @CurrentUser() u: { sub: string },
    @Body(new ZodValidationPipe(adjust)) b: z.infer<typeof adjust>,
  ) {
    return ApiResponse.ok(await this.service.adjust(id, b, u.sub));
  }
  @Post("publish")
  @RequirePermission("assignment", "manage")
  async publish(
    @Param("termId", ParseUUIDPipe) id: string,
    @CurrentUser() u: { sub: string },
    @Body(new ZodValidationPipe(revision)) b: z.infer<typeof revision>,
  ) {
    return ApiResponse.ok(await this.service.publish(id, b.revision, u.sub));
  }
}
