import { Injectable } from "@nestjs/common";
import { confirmationError } from "./defense-confirmation.dto";
import {
  defenseConfirmationReportQuerySchema,
  type DefenseConfirmationReportIdentity,
} from "./defense-confirmation-report.dto";
import type { PdfContext } from "./defense-confirmation.types";

@Injectable()
export class DefenseConfirmationReportValidator {
  input(value: unknown): DefenseConfirmationReportIdentity {
    const parsed = defenseConfirmationReportQuerySchema.safeParse(value);
    if (!parsed.success)
      confirmationError(
        400,
        "PDF_IDENTITY_REQUIRED",
        "Cần finalReportId, revision và checksum hợp lệ từ context UC17.",
      );
    return parsed.data;
  }

  metadata(pdf: PdfContext) {
    if (pdf.state === "NOT_SUBMITTED")
      confirmationError(404, "UC17_PDF_NOT_FOUND", "Chưa có PDF hiện hành.");
    if (pdf.state !== "UNVERIFIED" || !pdf.snapshot)
      confirmationError(
        409,
        "UC17_PDF_NOT_READY",
        "PDF hiện hành chưa đủ bằng chứng hợp lệ; cần tải lại context.",
      );
    return pdf.snapshot;
  }

  expected(
    expected: DefenseConfirmationReportIdentity,
    actual: NonNullable<PdfContext["snapshot"]>,
  ) {
    if (
      expected.finalReportId !== actual.finalReportId ||
      expected.revision !== actual.revision ||
      expected.checksum !== actual.checksum
    )
      this.changed();
  }

  changed(): never {
    confirmationError(
      409,
      "PDF_CONTEXT_CHANGED",
      "PDF đã thay đổi; hãy tải lại context trước khi tải file.",
    );
  }
}
