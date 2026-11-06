import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ApiResponse } from "../../common/dto/api-response.dto";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/security/current-user.decorator";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import {
  semesterCreateSchema,
  SemesterCreateDto,
  semesterQuerySchema,
} from "../dto/term.dto";
import { TermLifecycleService } from "../service/term-lifecycle.service";
@ApiTags("semester")
@ApiBearerAuth()
@Controller("semesters")
export class AcademicSemesterController {
  constructor(private readonly service: TermLifecycleService) {}
  @Get()
  @RequirePermission("term", "read")
  async list(
    @Query(new ZodValidationPipe(semesterQuerySchema))
    query: {
      academicYear?: string;
      search?: string;
    },
  ) {
    return ApiResponse.ok(await this.service.semesters(query));
  }
  @Post()
  @RequirePermission("term", "create")
  async create(
    @Body(new ZodValidationPipe(semesterCreateSchema)) input: SemesterCreateDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.createSemester(input, user.userId),
    );
  }
}
