import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DossierFinalizeSchema, DossierReceiptSchema } from "@doan/shared";
import type { DossierView } from "@doan/shared";
import { DossierStatus, dossierStateLabel } from "./components";
const base = {
  proposalStatus: "APPROVED",
  state: "FINALIZED",
  currentFinalization: {
    versionNumber: 2,
    finalizedAt: "2026-10-22T00:00:00Z",
    pdfGeneratedAt: null,
  },
  receipt: null,
} as DossierView;
describe("Step 7 dossier presentation", () => {
  it("separates approval/finalization/PDF and physical receipt", () => {
    const html = renderToStaticMarkup(<DossierStatus dossier={base} />);
    expect(html).toContain("Đã được duyệt");
    expect(html).toContain("v2");
    expect(html).toContain("Chưa tạo");
    expect(html).toContain("Chưa ghi nhận");
  });
  it("generating a PDF never presents paper as received", () => {
    const html = renderToStaticMarkup(
      <DossierStatus
        dossier={{
          ...base,
          currentFinalization: {
            ...base.currentFinalization!,
            pdfGeneratedAt: "2026-10-22Z",
          },
        }}
      />,
    );
    expect(html).toContain("Đã tạo từ snapshot đã chốt");
    expect(html).toContain("Chưa ghi nhận");
  });
  it("uses explicit received/reopened labels and validates stale/revision inputs", () => {
    expect(dossierStateLabel("RECEIVED")).toBe("Đã tiếp nhận bản giấy");
    expect(dossierStateLabel("REOPENED")).toBe("Đã mở lại");
    expect(
      DossierFinalizeSchema.safeParse({ approvedVersionId: "v" }).success,
    ).toBe(false);
    expect(
      DossierReceiptSchema.safeParse({
        expectedRevision: -1,
        finalizationId: "f",
      }).success,
    ).toBe(false);
  });
});
