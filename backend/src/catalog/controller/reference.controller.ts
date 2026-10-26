import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ReferenceService } from "../service/reference.service";
import { ApiResponse } from "../../common/dto/api-response.dto";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/security/current-user.decorator";
@ApiTags("catalog")
@ApiBearerAuth()
@Controller()
export class ReferenceController {
  constructor(private readonly service: ReferenceService) {}
  @Get("departments")
  @RequirePermission("catalog", "read")
  async departments() {
    return ApiResponse.ok(await this.service.list("departments"));
  }
  @Get("training-systems")
  @RequirePermission("catalog", "read")
  async systems() {
    return ApiResponse.ok(await this.service.list("training-systems"));
  }
  @Get("research-areas") @RequirePermission("catalog", "read") async areas() {
    return ApiResponse.ok(await this.service.list("research-areas"));
  }
  @Post("departments")
  @RequirePermission("catalog", "manage")
  async createDepartment(
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.save("departments", undefined, body, user.sub),
    );
  }
  @Post("training-systems")
  @RequirePermission("catalog", "manage")
  async createSystem(
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.save("training-systems", undefined, body, user.sub),
    );
  }
  @Post("research-areas")
  @RequirePermission("catalog", "manage")
  async createArea(
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.save("research-areas", undefined, body, user.sub),
    );
  }
  @Patch("departments/:id")
  @RequirePermission("catalog", "manage")
  async updateDepartment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.save("departments", id, body, user.sub),
    );
  }
  @Patch("training-systems/:id")
  @RequirePermission("catalog", "manage")
  async updateSystem(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.save("training-systems", id, body, user.sub),
    );
  }
  @Patch("research-areas/:id")
  @RequirePermission("catalog", "manage")
  async updateArea(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.save("research-areas", id, body, user.sub),
    );
  }
}
