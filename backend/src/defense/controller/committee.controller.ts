import { Controller, Get, Param, Req, Inject } from "@nestjs/common";
import { CommitteeWorkflowService } from "../committees/committee-workflow.service";
import {
  committeeActor,
  CommitteeRequest,
} from "../committees/committee-workflow.controller";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ApiTags } from "@nestjs/swagger";
import { CommitteeService } from "../service/committee.service";
import { ApiResponse } from "../../common/dto/api-response.dto";

@ApiTags("defense")
@Controller("committees")
export class CommitteeController {
  constructor(
    @Inject(CommitteeService)
    private readonly committeeService: CommitteeService,
    @Inject(CommitteeWorkflowService)
    private readonly workflow: CommitteeWorkflowService,
  ) {}

  @Get("term/:termId")
  @RequirePermission("defense-committee", "read")
  async getCommittees(
    @Req() r: CommitteeRequest,
    @Param("termId") termId: string,
  ) {
    const scoped = await this.workflow.workspace(committeeActor(r), termId);
    const list = await this.committeeService.findByTerm(
      termId,
      scoped.committees.map((c) => c.id),
    );
    return ApiResponse.ok(list);
  }
}
