import { Injectable } from "@nestjs/common";
import { GuidanceService } from "../tasks/guidance.service";

@Injectable()
export class TaskService {
  constructor(private readonly guidance: GuidanceService) {}

  async findByPlan(userId: string, guidancePlanId: string) {
    return this.guidance.legacyTasks(userId, guidancePlanId);
  }
}
