import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { StudentService } from "../service/student.service";
import { ApiResponse } from "../../common/dto/api-response.dto";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/security/current-user.decorator";
import { CatalogInputValidator } from "../validator/catalog.validator";
@ApiTags("catalog")
@ApiBearerAuth()
@Controller("students")
export class StudentController {
  constructor(private readonly service: StudentService) {}
  @Get()
  @RequirePermission("student", "read")
  async list(@Query() raw: Record<string, string>) {
    return ApiResponse.ok(
      await this.service.findAll(CatalogInputValidator.query(raw)),
    );
  }
  @Get(":id")
  @RequirePermission("student", "read")
  async detail(@Param("id", ParseUUIDPipe) id: string) {
    return ApiResponse.ok(await this.service.detail(id));
  }
  @Post()
  @RequirePermission("catalog", "manage")
  async create(@Body() body: unknown, @CurrentUser() user: CurrentUserPayload) {
    return ApiResponse.ok(await this.service.save(undefined, body, user.sub));
  }
  @Patch(":id")
  @RequirePermission("catalog", "manage")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(await this.service.save(id, body, user.sub));
  }
}
