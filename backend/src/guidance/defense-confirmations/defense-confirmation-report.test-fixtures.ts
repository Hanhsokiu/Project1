import { FileStorageService } from "../../common/storage/file-storage.service";
import { PrismaService } from "../../prisma/prisma.service";
import { readFixture } from "./defense-confirmation-read.test-fixtures";
import { DefenseConfirmationReportRepository } from "./defense-confirmation-report.repository";
import { DefenseConfirmationReportService } from "./defense-confirmation-report.service";
import { DefenseConfirmationReportValidator } from "./defense-confirmation-report.validator";

export function reportFixture() {
  const f = readFixture();
  const repository = new DefenseConfirmationReportRepository(
    f.prisma as unknown as PrismaService,
  );
  const downloadValidator = new DefenseConfirmationReportValidator();
  const downloadService = new DefenseConfirmationReportService(
    repository,
    f.access,
    f.validator,
    downloadValidator,
    f.storage as unknown as FileStorageService,
  );
  const identity = { ...f.input().expectedContext.pdf! };
  const download = (input: unknown = identity) =>
    downloadService.download(f.state.user?.id ?? "missing", "proposal", input);
  return {
    ...f,
    repository,
    downloadValidator,
    downloadService,
    identity,
    download,
  };
}
