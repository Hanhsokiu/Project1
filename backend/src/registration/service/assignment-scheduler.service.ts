import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { AssignmentRepository } from "../repository/assignment.repository";
import { AssignmentPlanService } from "./assignment-plan.service";

@Injectable()
export class AssignmentSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AssignmentSchedulerService.name);
  private running = false;
  constructor(
    private readonly repo: AssignmentRepository,
    private readonly plans: AssignmentPlanService,
  ) {}
  async onApplicationBootstrap() {
    await this.tick();
  }
  @Interval(30000)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const at = new Date();
      for (const term of await this.repo.scheduledTerms(at)) {
        try {
          await this.plans.scheduledDraft(term.id, at);
        } catch {
          this.logger.error(
            `Không tạo được phân công tự động cho đợt ${term.id}; sẽ thử lại ở lượt sau.`,
          );
        }
      }
    } catch {
      this.logger.error(
        "Không đọc được lịch phân công; sẽ thử lại ở lượt sau.",
      );
    } finally {
      this.running = false;
    }
  }
}
