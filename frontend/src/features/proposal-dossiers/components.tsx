import React from "react";
import type { DossierView, DossierPrintSnapshot } from "@doan/shared";
import { ProposalContent } from "../proposal-reviews/components";
export const dossierStateLabel = (state: DossierView["state"]) =>
  state
    ? {
        DRAFT: "Chưa chốt",
        FINALIZED: "Đã chốt chính thức",
        RECEIVED: "Đã tiếp nhận bản giấy",
        REOPENED: "Đã mở lại",
      }[state]
    : "Hồ sơ cần đối soát";
export function DossierSnapshotPreview({
  snapshot,
}: {
  snapshot: DossierPrintSnapshot;
}) {
  return (
    <section
      className="rg-panel p-5 space-y-3"
      aria-label="Xem trước nội dung in"
    >
      <h2 className="font-semibold">{snapshot.title}</h2>
      <p>
        {snapshot.student.name} · {snapshot.student.code}
      </p>
      <p>
        Lớp: {snapshot.student.className} · Ngành: {snapshot.student.majorName}
      </p>
      <p>
        Khóa: {snapshot.student.cohort || "Chưa có dữ liệu"} · Hệ đào tạo:{" "}
        {snapshot.student.trainingSystem}
      </p>
      <p>
        Số điện thoại: {snapshot.student.phone || "Chưa có dữ liệu"} · Email:{" "}
        {snapshot.student.email || "Chưa có dữ liệu"}
      </p>
      <p>
        GVHD: {snapshot.advisor.name} · {snapshot.advisor.department}
      </p>
      <p>
        Số điện thoại GVHD: {snapshot.advisor.phone || "Chưa có dữ liệu"} ·
        Email GVHD: {snapshot.advisor.email || "Chưa có dữ liệu"}
      </p>
      <ProposalContent content={snapshot.content} />
      <p className="text-sm text-slate-500">
        Bản in có bốn vị trí ký giấy: Trưởng Khoa, Trưởng Bộ môn, GVHD và sinh
        viên. Chưa có chữ ký trên hệ thống.
      </p>
    </section>
  );
}
export function DossierStatus({ dossier: d }: { dossier: DossierView }) {
  return (
    <section className="rg-panel p-5 space-y-3" aria-label="Trạng thái hồ sơ">
      <h2 className="font-semibold">{dossierStateLabel(d.state)}</h2>
      <p>
        Duyệt đề cương:{" "}
        {d.proposalStatus === "APPROVED"
          ? "Đã được duyệt"
          : "Chưa đủ điều kiện chốt"}
      </p>
      <p>
        Chốt chính thức:{" "}
        {d.currentFinalization
          ? `v${d.currentFinalization.versionNumber} · ${new Date(d.currentFinalization.finalizedAt).toLocaleString("vi-VN")}`
          : "Chưa chốt"}
      </p>
      <p>
        PDF:{" "}
        {d.currentFinalization?.pdfGeneratedAt
          ? "Đã tạo từ snapshot đã chốt"
          : "Chưa tạo"}
      </p>
      <p>
        Tiếp nhận bản giấy:{" "}
        {d.receipt
          ? new Date(d.receipt.receivedAt).toLocaleString("vi-VN")
          : "Chưa ghi nhận"}
      </p>
    </section>
  );
}
