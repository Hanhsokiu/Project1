import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import { AssignmentRepository } from "../repository/assignment.repository";
import { AssignmentPlanService } from "./assignment-plan.service";

@Injectable()
export class AssignmentWorkerService implements OnApplicationBootstrap {
  private running = false;
  private readonly logger = new Logger(AssignmentWorkerService.name);

  constructor(
    private readonly repo: AssignmentRepository,
    private readonly plans: AssignmentPlanService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    // Catch up if the server was restarted after the assignment window opened.
    await this.tick();
  }

  @Interval(10000)
  async tick() {
    const enabled = this.config.get<string | boolean>(
      "ASSIGNMENT_WORKER_ENABLED",
    );
    if (
      this.running ||
      !(
        enabled === true ||
        enabled === "true" ||
        (enabled === undefined && this.config.get("NODE_ENV") !== "test")
      )
    )
      return;
    this.running = true;
    try {
      for (const term of await this.repo.dueForAutomaticDraft()) {
        try {
          const result = await this.plans.createAutomaticDraft(term.id);
          if (result)
            this.logger.log(
              `Created automatic assignment draft for ${term.code}`,
            );
        } catch {
          // A failed term must not prevent other due terms from being handled.
          // Avoid logging raw database errors that can contain student details.
          this.logger.error(
            `Could not create assignment draft for term ${term.id}; will retry`,
          );
        }
      }
    } catch {
      this.logger.error("Could not load due assignment terms; will retry");
    } finally {
      this.running = false;
    }
  }
}
