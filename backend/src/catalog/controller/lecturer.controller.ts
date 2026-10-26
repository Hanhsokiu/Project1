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
import { LecturerService } from "../service/lecturer.service";
import { ApiResponse } from "../../common/dto/api-response.dto";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/security/current-user.decorator";
import { CatalogInputValidator } from "../validator/catalog.validator";
@ApiTags("catalog")
@ApiBearerAuth()
@Controller("lecturers")
export class LecturerController {
  constructor(private readonly service: LecturerService) {}
  @Get()
  @RequirePermission("lecturer", "read")
  async list(@Query() raw: Record<string, string>) {
    return ApiResponse.ok(
      await this.service.findAll(CatalogInputValidator.query(raw)),
    );
  }
  @Get(":id")
  @RequirePermission("lecturer", "read")
  async detail(@Param("id", ParseUUIDPipe) id: string) {
    return ApiResponse.ok(await this.service.detail(id));
  }
  @Post()
  @RequirePermission("catalog", "manage")
  async create(@Body() body: unknown, @CurrentUser() user: CurrentUserPayload) {
    return ApiResponse.ok(await this.service.save(undefined, body, user.sub));
  }
  @Patch(":id")
  @RequirePermission("lecturer", "update")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(await this.service.save(id, body, user.sub));
  }
}
