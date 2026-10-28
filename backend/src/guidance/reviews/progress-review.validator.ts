import { Injectable } from "@nestjs/common";
import type { ProgressReviewResult } from "@prisma/client";
import type { GuidanceTaskRecord } from "../tasks/guidance.repository";
import type { SubmissionRecord } from "../submissions/submission.repository";
import type {
  ProgressReviewRecord,
  MeetingRecord,
} from "./progress-review.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
@Injectable()
export class ProgressReviewValidator {
  comment(decision: ProgressReviewResult, comment?: string) {
    if (decision !== "PASS" && !comment?.trim())
      groupError(
        400,
        "REVIEW_COMMENT_REQUIRED",
        "Không đạt/Cần sửa bắt buộc có nhận xét.",
      );
  }
  current(
    t: GuidanceTaskRecord,
    sub: SubmissionRecord,
    old?: ProgressReviewRecord,
  ) {
    const tw = t.pr2bTaskWorkflowTaskId,
      sw = sub.pr2bSubmissionWorkflowSubmissionId;
    if (tw?.currentSubmissionId !== sub.id || sw?.state === "SUPERSEDED")
      groupError(
        409,
        "STALE_SUBMISSION",
        "Bài nộp không còn là phiên bản hiện hành.",
      );
    if (
      !sw?.contextSnapshot ||
      sw.versionNumber === null ||
      !sw.submittedAt ||
      !sw.submittedByUserId ||
      !sw.deadlineSnapshot ||
      sw.isLate === null ||
      !tw?.state
    )
      groupError(
        409,
        "INPUT_NOT_READY",
        "Bài nộp legacy/chưa có metadata chính thức.",
      );
    if (old) {
      if (
        old.submissionId !== sub.id ||
        old.state !== "RECORDED" ||
        sw.effectiveReviewId !== old.id
      )
        groupError(409, "STALE_REVIEW", "Đánh giá không còn hiệu lực.");
      if (
        sw.state !== "REVIEWED" ||
        !["COMPLETED", "REVISION_REQUESTED"].includes(tw.state)
      )
        groupError(
          409,
          "STATE_TRANSITION_INVALID",
          "Trạng thái không cho phép sửa đánh giá.",
        );
    } else {
      if (sw.effectiveReviewId)
        groupError(
          409,
          "REVIEW_ALREADY_RECORDED",
          "Bài nộp đã có đánh giá; dùng chức năng sửa có lý do.",
        );
      if (sw.state !== "SUBMITTED" || tw.state !== "SUBMITTED")
        groupError(
          409,
          "STATE_TRANSITION_INVALID",
          "Chỉ đánh giá nhiệm vụ đã có bài nộp hiện hành.",
        );
    }
    const snapshot = sw.contextSnapshot as {
      studentId?: string;
      planId?: string;
      periodId?: string;
      files?: Array<{ fileId: string; checksum: string }>;
    };
    if (
      snapshot.planId !== t.guidancePlanId ||
      snapshot.periodId !== tw.periodId ||
      !Array.isArray(snapshot.files) ||
      !snapshot.files.length ||
      snapshot.files.length !== sub.pr2bSubmissionAssetSubmissionId.length ||
      !["REPORT", "SOURCE"].every((kind) =>
        sub.pr2bSubmissionAssetSubmissionId.some(
          (f) => f.refFileId.kind === kind,
        ),
      ) ||
      sub.pr2bSubmissionAssetSubmissionId.some(
        (f) =>
          f.refFileId.state !== "READY" ||
          !snapshot.files!.some(
            (x) => x.fileId === f.fileId && x.checksum === f.refFileId.checksum,
          ),
      )
    )
      groupError(
        409,
        "FILE_NOT_READY",
        "Thiếu chứng cứ/file khớp snapshot bài nộp.",
      );
    return { tw, sw };
  }
  taskState(decision: ProgressReviewResult) {
    return decision === "PASS"
      ? ("COMPLETED" as const)
      : ("REVISION_REQUESTED" as const);
  }
  meeting(m: MeetingRecord) {
    const w = m.pr2bMeetingWorkflowMeetingId;
    if (
      !w?.authorUserId ||
      !["IN_PERSON", "ONLINE"].includes(w.mode ?? "") ||
      !w.discussion ||
      !w.conclusion
    )
      groupError(
        409,
        "INPUT_NOT_READY",
        "Nhật ký legacy cần đối soát; không tự tách nội dung cũ.",
      );
    return w;
  }
}
