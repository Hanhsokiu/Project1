import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { TermLifecycleService } from "../service/term-lifecycle.service";
import { TermWindowService } from "../service/term-window.service";
import { ApiResponse } from "../../common/dto/api-response.dto";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/security/current-user.decorator";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import {
  latestTermQuerySchema,
  operationQuerySchema,
  parametersSchema,
  phasePlanSchema,
  rosterSchema,
  termCreateSchema,
  termLockSchema,
  termPatchSchema,
  termQuerySchema,
  termStatusSchema,
} from "../dto/term.dto";
import type {
  PhaseCode,
  PhaseInput,
  RosterDto,
  TermCreateDto,
  TermPatchDto,
  TermQueryDto,
} from "../dto/term.dto";
import { TermStatus } from "@prisma/client";

@ApiTags("term")
@ApiBearerAuth()
@Controller("terms")
export class ThesisTermController {
  constructor(
    private readonly service: TermLifecycleService,
    private readonly windows: TermWindowService,
  ) {}
  @Get()
  @RequirePermission("term", "read")
  @ApiOperation({ summary: "Danh sách đợt theo kỳ/hệ, tìm kiếm và phân trang" })
  async list(
    @Query(new ZodValidationPipe(termQuerySchema)) query: TermQueryDto,
  ) {
    return ApiResponse.ok(await this.service.findAll(query));
  }

  @Get("latest")
  @RequirePermission("term", "read")
  async latest(
    @Query(new ZodValidationPipe(latestTermQuerySchema))
    query: {
      trainingSystemId: string;
      semesterId: string;
    },
  ) {
    return ApiResponse.ok(
      await this.service.latest(query.trainingSystemId, query.semesterId),
    );
  }

  @Get(":id")
  @RequirePermission("term", "read")
  async detail(@Param("id") id: string) {
    return ApiResponse.ok(await this.service.findById(id));
  }

  @Get(":id/operation-window")
  @RequirePermission("term", "read")
  async window(
    @Param("id") id: string,
    @Query(new ZodValidationPipe(operationQuerySchema))
    query: { phaseCode: PhaseCode },
  ) {
    return ApiResponse.ok(await this.windows.getWindow(id, query.phaseCode));
  }

  @Post()
  @RequirePermission("term", "create")
  async create(
    @Body(new ZodValidationPipe(termCreateSchema)) input: TermCreateDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.create(input, user.userId),
      "Đã tạo đợt đồ án.",
    );
  }

  @Patch(":id")
  @RequirePermission("term", "update")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(termPatchSchema)) input: TermPatchDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(await this.service.update(id, input, user.userId));
  }

  @Patch(":id/status")
  @RequirePermission("term", "transition")
  async transition(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(termStatusSchema))
    input: { status: TermStatus },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.transition(id, input.status, user.userId),
    );
  }

  @Patch(":id/lock")
  @RequirePermission("term", "lock")
  async lock(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(termLockSchema)) input: { locked: boolean },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.lock(id, input.locked, user.userId),
    );
  }

  @Put(":id/phases")
  @RequirePermission("term", "plan")
  async phases(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(phasePlanSchema))
    input: { phases: PhaseInput[] },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.savePhases(id, input.phases, user.userId),
    );
  }

  @Put(":id/parameters")
  @RequirePermission("term", "parameters")
  async parameters(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(parametersSchema))
    input: { parameters: Record<string, number> },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.saveParameters(id, input.parameters, user.userId),
    );
  }

  @Put(":id/roster")
  @RequirePermission("term", "roster")
  async roster(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(rosterSchema)) input: RosterDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.saveRoster(id, input, user.userId),
    );
  }
}
