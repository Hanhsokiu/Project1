import { describe, expect, it, vi } from "vitest";
import { AssignmentSchedulerService } from "./assignment-scheduler.service";
import { AssignmentRepository } from "../repository/assignment.repository";
import { AssignmentPlanService } from "./assignment-plan.service";

describe("assignment scheduler lifecycle", () => {
  it("catches up on application startup and continues after one term fails", async () => {
    const repo = {
      scheduledTerms: vi.fn(async () => [{ id: "a" }, { id: "b" }]),
    };
    const plans = {
      scheduledDraft: vi
        .fn()
        .mockRejectedValueOnce(new Error("unavailable"))
        .mockResolvedValue(undefined),
    };
    const scheduler = new AssignmentSchedulerService(
      repo as unknown as AssignmentRepository,
      plans as unknown as AssignmentPlanService,
    );
    await scheduler.onApplicationBootstrap();
    expect(plans.scheduledDraft.mock.calls.map((args) => args[0])).toEqual([
      "a",
      "b",
    ]);
    await scheduler.tick();
    expect(plans.scheduledDraft).toHaveBeenCalledTimes(4);
  });
  it("prevents overlapping ticks and recovers after a database failure", async () => {
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const repo = {
      scheduledTerms: vi.fn(async () => {
        await wait;
        throw new Error("offline");
      }),
    };
    const plans = { scheduledDraft: vi.fn() };
    const scheduler = new AssignmentSchedulerService(
      repo as unknown as AssignmentRepository,
      plans as unknown as AssignmentPlanService,
    );
    const first = scheduler.tick();
    await scheduler.tick();
    expect(repo.scheduledTerms).toHaveBeenCalledTimes(1);
    release();
    await first;
    await scheduler.tick();
    expect(repo.scheduledTerms).toHaveBeenCalledTimes(2);
  });
});
