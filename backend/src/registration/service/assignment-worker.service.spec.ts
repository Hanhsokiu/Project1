import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssignmentRepository } from "../repository/assignment.repository";
import { AssignmentPlanService } from "./assignment-plan.service";
import { AssignmentWorkerService } from "./assignment-worker.service";

function setup(settings: Record<string, string | undefined> = {}) {
  const repo = {
    dueForAutomaticDraft: vi.fn(async () => [{ id: "one", code: "ONE" }]),
  };
  const plans = { createAutomaticDraft: vi.fn(async (_id: string) => null) };
  const config = {
    get: (key: string) => ({ NODE_ENV: "development", ...settings })[key],
  };
  const worker = new AssignmentWorkerService(
    repo as unknown as AssignmentRepository,
    plans as unknown as AssignmentPlanService,
    config as unknown as ConfigService,
  );
  return { worker, repo, plans };
}

beforeEach(() => {
  vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("automatic assignment worker", () => {
  it("catches up when the application starts", async () => {
    const { worker, plans } = setup();
    await worker.onApplicationBootstrap();
    expect(plans.createAutomaticDraft).toHaveBeenCalledWith("one");
  });

  it.each([{ ASSIGNMENT_WORKER_ENABLED: "false" }, { NODE_ENV: "test" }])(
    "does not discover terms when disabled: %j",
    async (settings) => {
      const { worker, repo } = setup(settings);
      await worker.tick();
      expect(repo.dueForAutomaticDraft).not.toHaveBeenCalled();
    },
  );

  it("can explicitly enable the worker in an isolated test environment", async () => {
    const { worker, plans } = setup({
      NODE_ENV: "test",
      ASSIGNMENT_WORKER_ENABLED: "true",
    });
    await worker.tick();
    expect(plans.createAutomaticDraft).toHaveBeenCalledOnce();
  });

  it("does not overlap periodic runs", async () => {
    const { worker, repo } = setup();
    let release!: () => void;
    repo.dueForAutomaticDraft.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return [];
    });
    const first = worker.tick();
    await worker.tick();
    expect(repo.dueForAutomaticDraft).toHaveBeenCalledOnce();
    release();
    await first;
    await worker.tick();
    expect(repo.dueForAutomaticDraft).toHaveBeenCalledTimes(2);
  });

  it("continues with another term after a failure", async () => {
    const { worker, repo, plans } = setup();
    repo.dueForAutomaticDraft.mockResolvedValueOnce([
      { id: "one", code: "ONE" },
      { id: "two", code: "TWO" },
    ]);
    plans.createAutomaticDraft.mockRejectedValueOnce(
      new Error("temporary conflict"),
    );
    await worker.tick();
    expect(plans.createAutomaticDraft.mock.calls.map(([id]) => id)).toEqual([
      "one",
      "two",
    ]);
  });

  it("recovers after discovery fails", async () => {
    const { worker, repo, plans } = setup();
    repo.dueForAutomaticDraft.mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    await worker.tick();
    await worker.tick();
    expect(plans.createAutomaticDraft).toHaveBeenCalledOnce();
  });
});
