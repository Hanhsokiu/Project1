import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { TopicService } from "../service/topic.service";
import { ProposalPdfService } from "../service/proposal-pdf.service";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { CurrentUser } from "../../common/security/current-user.decorator";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import { ApiResponse } from "../../common/dto/api-response.dto";
import { proposalWrite } from "../dto/proposal.dto";
interface PdfResponse {
  setHeader(name: string, value: string): void;
  send(body: Buffer): void;
}
const agreement = z
  .object({ agreed: z.boolean(), expectedVersion: z.number().int().min(1) })
  .strict();
@ApiTags("topic")
@ApiBearerAuth()
@Controller("topics")
export class TopicController {
  constructor(
    private readonly service: TopicService,
    private readonly pdf: ProposalPdfService,
  ) {}
  @Get("term/:termId")
  @RequirePermission("topic", "read")
  async list(
    @Param("termId", ParseUUIDPipe) id: string,
    @CurrentUser() u: { sub: string },
  ) {
    return ApiResponse.ok(await this.service.list(id, u.sub));
  }
  @Put("term/:termId/student/:studentId/draft")
  @RequirePermission("topic", "write")
  async draft(
    @Param("termId", ParseUUIDPipe) id: string,
    @Param("studentId", ParseUUIDPipe) sid: string,
    @CurrentUser() u: { sub: string },
    @Body(new ZodValidationPipe(proposalWrite))
    b: z.infer<typeof proposalWrite>,
  ) {
    return ApiResponse.ok(await this.service.save(id, sid, u.sub, b, false));
  }
  @Post("term/:termId/student/:studentId/submit")
  @RequirePermission("topic", "write")
  async submit(
    @Param("termId", ParseUUIDPipe) id: string,
    @Param("studentId", ParseUUIDPipe) sid: string,
    @CurrentUser() u: { sub: string },
    @Body(new ZodValidationPipe(proposalWrite))
    b: z.infer<typeof proposalWrite>,
  ) {
    return ApiResponse.ok(await this.service.save(id, sid, u.sub, b, true));
  }
  @Post(":id/agree")
  @RequirePermission("topic", "write")
  async agree(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() u: { sub: string },
    @Body(new ZodValidationPipe(agreement)) b: z.infer<typeof agreement>,
  ) {
    return ApiResponse.ok(
      await this.service.agree(id, u.sub, b.agreed, b.expectedVersion),
    );
  }
  @Get(":id/versions/:version/pdf")
  @RequirePermission("topic", "read")
  async download(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("version", ParseIntPipe) version: number,
    @CurrentUser() u: { sub: string },
    @Query(
      "degree",
      new ZodValidationPipe(
        z.enum(["bachelor", "engineer"]).default("bachelor"),
      ),
    )
    degree: "bachelor" | "engineer",
    @Res() response: PdfResponse,
  ) {
    const data = await this.service.version(id, version, u.sub);
    const bytes = await this.pdf.render(data, degree);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="de-cuong-v${version}.pdf"`,
    );
    response.setHeader("Cache-Control", "private, no-store");
    response.send(bytes);
  }
}
