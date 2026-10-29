import type { ReactNode } from "react";
import { Notice } from "../../../shared/components/kit";
import { gradingMode } from "./api";

export function GradingUnavailable() {
  return (
    <Notice tone="warning">
      Chức năng chấm điểm chính thức chưa được bật trong môi trường này.
    </Notice>
  );
}

export function GradingDemoBoundary({ children }: { children: ReactNode }) {
  if (gradingMode() !== "DEMO") return <GradingUnavailable />;
  return (
    <>
      <Notice tone="warning">
        DỮ LIỆU DEMO — KHÔNG LƯU VÀO HỆ THỐNG CHÍNH THỨC
      </Notice>
      {children}
    </>
  );
}
