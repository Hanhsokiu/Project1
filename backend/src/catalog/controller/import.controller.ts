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
interface BinaryResponse {
  setHeader(name: string, value: string): void;
  send(buffer: Buffer): void;
}
import { ImportService } from "../service/import.service";
import { ApiResponse } from "../../common/dto/api-response.dto";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/security/current-user.decorator";
import { ImportConfirmationValidator } from "../validator/import-confirmation.validator";
@ApiTags("catalog-import")
@ApiBearerAuth()
@Controller("imports")
export class ImportController {
  constructor(private readonly service: ImportService) {}
  @Get("students/template")
  @RequirePermission("student", "import")
  async template(@Query("format") format = "csv", @Res() res: BinaryResponse) {
    const buffer = await this.service.template(format);
    res.setHeader(
      "Content-Type",
      format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv; charset=utf-8",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="mau-import-sinh-vien.${format}"`,
    );
    res.send(buffer);
  }
  @Post("students/preview")
  @RequirePermission("student", "import")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async preview(
    @UploadedFile() file: Express.Multer.File,
    @Body("termId", ParseUUIDPipe) termId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(await this.service.preview(file, termId, user.sub));
  }
  @Get(":id")
  @RequirePermission("student", "import")
  async detail(@Param("id", ParseUUIDPipe) id: string) {
    return ApiResponse.ok(await this.service.detail(id));
  }
  @Post(":id/confirm")
  @RequirePermission("student", "import")
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
