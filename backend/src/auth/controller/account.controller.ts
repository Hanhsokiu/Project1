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
import { AccountService, SaveAccountInput } from "../service/account.service";
import { ApiResponse } from "../../common/dto/api-response.dto";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/security/current-user.decorator";

@ApiTags("accounts")
@ApiBearerAuth()
@Controller("accounts")
export class AccountController {
  constructor(private readonly service: AccountService) {}

  @Get()
  @RequirePermission("account", "read")
  async list(
    @Query("page") page = 1,
    @Query("limit") limit = 100,
    @Query("search") search?: string,
  ) {
    return ApiResponse.ok(
      await this.service.findAll({
        page: Number(page) || 1,
        limit: Number(limit) || 100,
        search,
      }),
    );
  }

  @Post()
  @RequirePermission("account", "create")
  async create(
    @Body() body: SaveAccountInput,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(await this.service.create(body, user.sub));
  }

  @Patch(":id")
  @RequirePermission("account", "update")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: Partial<SaveAccountInput>,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(await this.service.update(id, body, user.sub));
  }

  @Patch(":id/status")
  @RequirePermission("account", "lock")
  async toggleStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(await this.service.toggleLock(id, user.sub));
  }

  @Post(":id/reset-password")
  @RequirePermission("account", "update")
  async resetPassword(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(await this.service.resetPassword(id, user.sub));
  }
}
