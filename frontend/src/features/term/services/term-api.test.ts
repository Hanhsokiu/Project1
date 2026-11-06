import { describe, expect, it, vi } from "vitest";
import type { Phase } from "../../../shared/data/types";
const { apiData } = vi.hoisted(() => ({
  apiData: vi.fn().mockResolvedValue({}),
}));
vi.mock("../../../shared/data/snapshot-api", () => ({
  apiData,
  getStep1Resources: () => undefined,
}));
import { termApi } from "./term-api";

describe("phase plan payload compatibility", () => {
  it("keeps legacy phase codes after inserting a review window and converts Vietnam time correctly", async () => {
    const base: Phase[] = [
      "Đăng ký",
      "Phân công",
      "Đề cương",
      "Hướng dẫn",
      "Final",
      "Bảo vệ",
    ].map((name, i) => ({
      id: `00000000-0000-4000-8000-00000000000${i}`,
      name,
      start: "2026-10-29T10:32",
      end: "2026-11-11T01:23",
      locked: false,
    }));
    base.splice(3, 0, {
      ...base[2],
      id: "new-review",
      name: "Xét duyệt",
      code: "PROPOSAL_REVIEW",
    });
    await termApi.savePhases("term", base);
    const payload = apiData.mock.calls[0][2];
    expect(payload.phases.map((p: { code: string }) => p.code)).toEqual([
      "REGISTRATION",
      "ASSIGNMENT",
      "PROPOSAL",
      "PROPOSAL_REVIEW",
      "WEEKLY",
      "FINAL",
      "DEFENSE",
    ]);
    expect(payload.phases[3]).toMatchObject({
      id: undefined,
      start: "2026-10-29T10:32+07:00",
      end: "2026-11-11T01:23+07:00",
    });
    expect(payload.phases[4].id).toBe(base[4].id);
  });
});
