import { Injectable, NotFoundException } from "@nestjs/common";
import { TermStatus } from "@prisma/client";
import { BusinessException } from "../../common/exception/business.exception";
import { ErrorCode } from "../../common/exception/error-code.enum";
import { PhaseCode } from "../dto/term.dto";
import { phasesFromTerm } from "../dto/term.mapper";
import {
  LoadedTerm,
  TermRepository,
  TermTransaction,
} from "../repository/term.repository";

const states: Record<PhaseCode, TermStatus[]> = {
  REGISTRATION: ["OPEN_REGISTRATION"],
  ASSIGNMENT: ["CLOSED_REGISTRATION"],
  PROPOSAL: ["CLOSED_REGISTRATION", "IN_PROGRESS"],
  WEEKLY: ["IN_PROGRESS"],
  FINAL: ["IN_PROGRESS"],
  DEFENSE: ["DEFENDING"],
};
export function operationWindow(
  term: LoadedTerm,
  phaseCode: PhaseCode,
  at = new Date(),
) {
  const phase = phasesFromTerm(term).find((p) => p.code === phaseCode);
  let reason = "";
  if (term.isLocked) reason = "Đợt đã khóa.";
  else if (!phase) reason = "Chưa cấu hình giai đoạn thực hiện.";
  else if (phase.isLocked) reason = "Giai đoạn đã khóa.";
  else if (!states[phaseCode].includes(term.status))
    reason = "Trạng thái đợt không cho phép thao tác trong giai đoạn này.";
  else if (at < term.startDate) reason = "Chưa đến thời gian của đợt.";
  else if (at >= term.endDate) reason = "Đợt đã hết thời gian thực hiện.";
  else if (at < phase.startDate) reason = "Chưa đến thời gian thực hiện.";
  else if (at >= phase.endDate) reason = "Đã hết hạn thực hiện.";
  return {
    phaseCode,
    status: term.status,
    serverNow: at.toISOString(),
    startAt: phase?.startDate.toISOString() ?? null,
    endAt: phase?.endDate.toISOString() ?? null,
    locked: term.isLocked || !!phase?.isLocked,
    canWrite: !reason,
    reason: reason || null,
  };
}
@Injectable()
export class TermWindowService {
  constructor(private readonly repository: TermRepository) {}
  async getWindow(
    termId: string,
    phaseCode: PhaseCode,
    at = new Date(),
    tx?: TermTransaction,
  ) {
    const term = await this.repository.findById(termId, tx);
    if (!term) throw new NotFoundException("Không tìm thấy đợt.");
    return operationWindow(term, phaseCode, at);
  }
  async requireOpen(
    termId: string,
    phaseCode: PhaseCode,
    at = new Date(),
    tx?: TermTransaction,
  ) {
    const window = await this.getWindow(termId, phaseCode, at, tx);
    if (!window.canWrite)
      throw new BusinessException(
        window.locked
          ? ErrorCode.TERM_LOCKED
          : phaseCode === "REGISTRATION"
            ? ErrorCode.REGISTRATION_CLOSED
            : ErrorCode.TERM_TRANSITION_INVALID,
        window.reason!,
        409,
      );
    return window;
  }
}
