import type {
  ScheduleBatch,
  ScheduleCommand,
  ScheduleProposal,
  ScheduleSave,
  ScheduleSlot,
  ScheduleWorkspace,
} from "@doan/shared";
import { httpClient } from "../../../shared/api/http-client";
import type { WorkflowTerm } from "../../../shared/hooks/use-workflow-terms";
type Envelope<T> = { data: T };
const root = "/defense-schedules";
export type SchedulePreview = {
  rosterHash: string;
  slots: ScheduleSlot[];
  automaticOrder: string[];
  startAt: string;
  endAt: string;
  issues: string[];
};
const post = async (path: string, body: unknown, key: string) =>
  (
    await httpClient.post(root + path, body, {
      headers: { "Idempotency-Key": key },
    })
  ).data;
export const scheduleApi = {
  terms: async () =>
    (await httpClient.get<Envelope<WorkflowTerm[]>>(root + "/options")).data
      .data,
  workspace: async (termId: string) =>
    (
      await httpClient.get<Envelope<ScheduleWorkspace>>(root + "/workspace", {
        params: { termId },
      })
    ).data.data,
  propose: async (termId: string, ids: string[]) =>
    (
      await httpClient.get<Envelope<ScheduleProposal>>(root + "/proposal", {
        params: {
          termId,
          ...(ids.length ? { committeeIds: ids.join(",") } : {}),
        },
      })
    ).data.data,
  preview: async (sessionId: string | null, body: ScheduleSave) =>
    (
      await httpClient.post<Envelope<SchedulePreview>>(root + "/preview", {
        sessionId,
        body,
      })
    ).data.data,
  save: (id: string | null, body: ScheduleSave, key: string) =>
    post(id ? `/${encodeURIComponent(id)}/update` : "", body, key),
  assign: (body: ScheduleBatch, key: string) => post("/assignments", body, key),
  transition: (
    action: "finalize" | "publish" | "cancel",
    body: ScheduleCommand,
    key: string,
  ) => post("/" + action, body, key),
};
