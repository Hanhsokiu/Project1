import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import type { Response } from "express";
import { LecturerImportService } from "../service/lecturer-import.service";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/security/current-user.decorator";
import { ApiResponse } from "../../common/dto/api-response.dto";
import { ImportConfirmationValidator } from "../validator/import-confirmation.validator";

@ApiTags("catalog-import")
@ApiBearerAuth()
@Controller("imports/lecturers")
export class LecturerImportController {
  constructor(private readonly service: LecturerImportService) {}
  @Get("template")
  @RequirePermission("lecturer", "import")
  async template(@Query("format") format = "csv", @Res() res: Response) {
    const buffer = await this.service.template(format);
    res.setHeader(
      "Content-Type",
      format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv; charset=utf-8",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="mau-import-giang-vien.${format}"`,
    );
    res.send(buffer);
  }
  @Post("preview")
  @RequirePermission("lecturer", "import")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async preview(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(await this.service.preview(file, user.sub));
  }
  @Get(":id")
  @RequirePermission("lecturer", "import")
  async detail(@Param("id", ParseUUIDPipe) id: string) {
    return ApiResponse.ok(await this.service.detail(id));
  }
  @Post(":id/confirm")
  @RequirePermission("lecturer", "import")
  async confirm(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { mode?: unknown },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.confirm(
        id,
        ImportConfirmationValidator.mode(body.mode),
        user.sub,
      ),
    );
  }
}
