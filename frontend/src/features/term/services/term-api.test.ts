import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Phase } from "../../../shared/data/types";
const { apiData, resources } = vi.hoisted(() => ({
  apiData: vi.fn().mockResolvedValue({}),
  resources: vi.fn(),
}));
vi.mock("../../../shared/data/snapshot-api", () => ({
  apiData,
  getStep1Resources: resources,
}));
import { termApi } from "./term-api";
beforeEach(() => { apiData.mockClear(); resources.mockReturnValue(undefined); });

describe("phase plan payload compatibility", () => {
  it("keeps exact existing term instants when editing metadata rather than silently moving an exclusive end to midnight", async () => {
    const term = { id:"term",start:"2030-11-01",end:"2030-12-01",
      startDate:"2030-10-31T17:00:00.000Z",endDate:"2030-11-30T17:00:00.000Z" };
    resources.mockReturnValue({terms:[term],semesters:[{id:"s",name:"Semester"}],programs:[{id:"p",name:"Program"}]});
    await termApi.save({ ...term, name:"Updated term name",code:"TERM",semester:"Semester",program:"Program",
      registrationStart:"2030-11-01T00:00",registrationEnd:"2030-11-04T00:00" });
    expect(apiData.mock.calls[0][2]).toMatchObject({startDate:term.startDate,endDate:term.endDate});
  });
  it("sends the change reason together with unrounded phase instants", async () => {
    await termApi.savePhases("term",[{id:"new",code:"DEFENSE",name:"Defense",
      start:"2030-11-15T00:00:00.005",end:"2030-11-15T23:59:59.999",locked:false}],"Approved extension");
    expect(apiData.mock.calls[0][2]).toMatchObject({reason:"Approved extension",phases:[{
      start:"2030-11-15T00:00:00.005+07:00",end:"2030-11-15T23:59:59.999+07:00",
    }]});
  });
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
