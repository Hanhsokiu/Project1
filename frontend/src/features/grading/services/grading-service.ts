import { assert, mutate, now, uid } from "../../../shared/data/store";
import type {
  Account,
  Criterion,
  DemoDb,
  Score,
} from "../../../shared/data/types";
export type ScoreKind = Score["kind"];
export const rubricKey = (kind: ScoreKind) =>
  kind.toLowerCase() as keyof DemoDb["rubrics"];

export function canScore(
  db: DemoDb,
  user: Account | undefined,
  termId: string,
  studentId: string,
  kind: ScoreKind,
) {
  if (!user?.lecturerId) return false;
  const advisor = db.assignments.find(
    (a) => a.termId === termId && a.studentId === studentId,
  )?.lecturerId;
  const defense = db.defenses.find(
    (d) => d.termId === termId && d.studentId === studentId,
  );
  if (kind === "ADVISOR") return advisor === user.lecturerId;
  if (advisor === user.lecturerId) return false;
  const committee = db.committees.find((c) => c.id === defense?.committeeId);
  if (committee?.members.some((m) => m.lecturerId === advisor)) return false;
  if (kind === "REVIEWER")
    return (
      defense?.reviewerId === user.lecturerId &&
      defense?.reviewerPublished !== false
    );
  return (
    !!defense?.date &&
    defense.schedulePublished !== false &&
    !!committee?.members.some((m) => m.lecturerId === user.lecturerId)
  );
}

export function saveRubric(kind: ScoreKind, criteria: Criterion[]) {
  return mutate("Cấu hình Rubric", ["FACULTY"], (db) => {
    assert(
      !db.scores.some((s) => s.kind === kind),
      "Đã có phiếu điểm theo Rubric này. Không thay đổi tiêu chí.",
    );
    assert(
      criteria.length > 0 &&
        criteria.every(
          (c) => c.name.trim() && Number.isFinite(c.max) && c.max > 0,
        ),
      "Mỗi tiêu chí cần tên và điểm tối đa lớn hơn 0.",
    );
    assert(
      new Set(criteria.map((c) => c.id)).size === criteria.length,
      "Mã tiêu chí không được trùng.",
    );
    assert(
      Math.abs(criteria.reduce((sum, c) => sum + c.max, 0) - 10) < 0.0001,
      "Tổng điểm tối đa của Rubric phải bằng 10.",
    );
    db.rubrics[rubricKey(kind)] = criteria.map((c) => ({
      ...c,
      name: c.name.trim(),
    }));
  });
}

export interface SaveScoreInput {
  termId: string;
  studentId: string;
  kind: ScoreKind;
  values: Record<string, number>;
  comment: string;
  questions: string[];
  submit: boolean;
}
export function saveScore(input: SaveScoreInput) {
  return mutate(
    input.submit ? "Gửi phiếu điểm" : "Lưu nháp phiếu điểm",
    ["LECTURER", "COMMITTEE"],
    (db, user) => {
      const term = db.terms.find((t) => t.id === input.termId);
      assert(
        term && !term.locked && !term.resultsPublished,
        "Đợt đã khóa hoặc kết quả đã công bố.",
      );
      assert(
        canScore(db, user, input.termId, input.studentId, input.kind),
        "Bạn không được phân công chấm sinh viên theo vai trò này.",
        "FORBIDDEN",
      );
      const existing = db.scores.find(
        (s) =>
          s.termId === input.termId &&
          s.studentId === input.studentId &&
          s.kind === input.kind &&
          s.lecturerId === user.lecturerId,
      );
      assert(
        !existing || existing.status === "DRAFT",
        "Phiếu đã gửi/chốt không được sửa.",
      );
      const criteria = db.rubrics[rubricKey(input.kind)];
      const values: Record<string, number> = {};
      criteria.forEach((c) => {
        const value = input.values[c.id];
        if (value !== undefined) {
          assert(
            Number.isFinite(value) && value >= 0 && value <= c.max,
            `${c.name}: điểm phải từ 0 đến ${c.max}.`,
          );
          values[c.id] = value;
        }
      });
      const questions = input.questions.map((q) => q.trim()).filter(Boolean);
      if (input.submit) {
        assert(
          criteria.every((c) => values[c.id] !== undefined),
          "Cần nhập điểm cho tất cả tiêu chí.",
        );
        assert(
          input.comment.trim().length >= 10,
          "Nhận xét tối thiểu 10 ký tự.",
        );
        assert(
          input.kind !== "REVIEWER" || questions.length >= 2,
          "Phiếu phản biện cần ít nhất 2 câu hỏi.",
        );
      }
      const score: Score = {
        id: existing?.id ?? uid("diem"),
        termId: input.termId,
        studentId: input.studentId,
        lecturerId: user.lecturerId!,
        kind: input.kind,
        values,
        total:
          Math.round(
            Object.values(values).reduce((sum, n) => sum + n, 0) * 100,
          ) / 100,
        comment: input.comment.trim(),
        questions,
        status: input.submit ? "SUBMITTED" : "DRAFT",
        updatedAt: now(),
      };
      if (existing) Object.assign(existing, score);
      else db.scores.push(score);
      return score;
    },
  );
}

export function aggregateResult(db: DemoDb, termId: string, studentId: string) {
  const term = db.terms.find((t) => t.id === termId);
  const params = term?.parameters ?? {};
  const defense = db.defenses.find(
    (d) => d.termId === termId && d.studentId === studentId,
  );
  const committee = db.committees.find((c) => c.id === defense?.committeeId);
  const advisorId = db.assignments.find(
    (a) => a.termId === termId && a.studentId === studentId,
  )?.lecturerId;
  const scores = db.scores.filter(
    (s) =>
      s.termId === termId && s.studentId === studentId && s.status !== "DRAFT",
  );
  const advisor = scores.find(
    (s) => s.kind === "ADVISOR" && s.lecturerId === advisorId,
  );
  const reviewer = scores.find(
    (s) =>
      s.kind === "REVIEWER" &&
      s.lecturerId === defense?.reviewerId &&
      s.lecturerId !== advisorId,
  );
  const committeeScores = (committee?.members ?? [])
    .map((m) =>
      scores.find(
        (s) =>
          s.kind === "COMMITTEE" &&
          s.lecturerId === m.lecturerId &&
          s.lecturerId !== advisorId,
      ),
    )
    .filter((s): s is Score => !!s);
  const validCommittee =
    !!committee &&
    committee.members.length >= 3 &&
    committee.members.length <= 5 &&
    new Set(committee.members.map((m) => m.lecturerId)).size ===
      committee.members.length &&
    !committee.members.some((m) => m.lecturerId === advisorId);
  const configurationValid =
    Math.abs(
      (params.process_weight ?? 0.4) + (params.committee_weight ?? 0.6) - 1,
    ) < 0.0001 &&
    Math.abs(
      (params.advisor_weight_in_process ?? 0.5) +
        (params.reviewer_weight_in_process ?? 0.5) -
        1,
    ) < 0.0001;
  const complete =
    !!advisor &&
    !!reviewer &&
    validCommittee &&
    configurationValid &&
    committeeScores.length === committee!.members.length;
  const process =
    advisor && reviewer
      ? advisor.total * (params.advisor_weight_in_process ?? 0.5) +
        reviewer.total * (params.reviewer_weight_in_process ?? 0.5)
      : null;
  const defenseScore =
    validCommittee && committeeScores.length === committee!.members.length
      ? committeeScores.reduce((sum, s) => sum + s.total, 0) /
        committeeScores.length
      : null;
  const total =
    configurationValid && process !== null && defenseScore !== null
      ? process * (params.process_weight ?? 0.4) +
        defenseScore * (params.committee_weight ?? 0.6)
      : null;
  const min = params.min_pass_score ?? 5;
  const passed =
    complete &&
    process !== null &&
    defenseScore !== null &&
    total !== null &&
    [process, defenseScore, total].every((n) => n >= min);
  const expected = [advisor, reviewer, ...committeeScores].filter(
    (s): s is Score => !!s,
  );
  return {
    studentId,
    advisor: advisor?.total ?? null,
    reviewer: reviewer?.total ?? null,
    committeeScores,
    process,
    defenseScore,
    total,
    complete,
    passed,
    locked: complete && expected.every((s) => s.status === "LOCKED"),
    published: !!term?.resultsPublished,
    missing: [
      ...(!advisor ? ["Điểm GVHD"] : []),
      ...(!reviewer ? ["Điểm GVPB"] : []),
      ...(!validCommittee ? ["Hội đồng hợp lệ"] : []),
      ...(!configurationValid ? ["Trọng số cấu hình hợp lệ"] : []),
      ...(validCommittee && committeeScores.length !== committee!.members.length
        ? [
            `Điểm hội đồng (${committeeScores.length}/${committee!.members.length})`,
          ]
        : []),
    ],
    revision: defense?.revision ?? "",
    archiveReady:
      complete && (!defense?.revision || !!defense.revisionCompleted),
  };
}

export function lockResults(termId: string) {
  return mutate("Chốt bảng điểm đợt", ["FACULTY"], (db) => {
    const term = db.terms.find((t) => t.id === termId);
    assert(
      term && !term.locked && !term.resultsPublished,
      "Đợt đã khóa hoặc công bố.",
    );
    const students = db.defenses.filter((d) => d.termId === termId);
    assert(students.length, "Chưa có sinh viên được xếp lịch bảo vệ.");
    assert(
      students.every((d) => d.date && d.schedulePublished !== false),
      "Cần xếp và công bố lịch cho toàn bộ hồ sơ đã phân công.",
    );
    const incomplete = students.filter(
      (d) => !aggregateResult(db, termId, d.studentId).complete,
    );
    assert(
      !incomplete.length,
      `Còn ${incomplete.length} hồ sơ thiếu phiếu điểm đã gửi. Không thể chốt.`,
    );
    db.scores
      .filter((s) => s.termId === termId && s.status === "SUBMITTED")
      .forEach((s) => (s.status = "LOCKED"));
  });
}

export function publishResults(termId: string) {
  return mutate("Công bố kết quả bảo vệ", ["FACULTY"], (db) => {
    const term = db.terms.find((t) => t.id === termId);
    assert(
      term && !term.locked && !term.resultsPublished,
      "Đợt đã khóa hoặc công bố.",
    );
    const students = db.defenses.filter((d) => d.termId === termId && d.date);
    assert(students.length, "Chưa có kết quả để công bố.");
    assert(
      students.every((d) => aggregateResult(db, termId, d.studentId).locked),
      "Phải chốt đầy đủ điểm trước khi công bố.",
    );
    term.resultsPublished = true;
    term.status = "COMPLETED";
    students.forEach((d) =>
      db.notifications.unshift({
        id: uid("tb"),
        termId,
        userId:
          db.accounts.find((a) => a.studentId === d.studentId)?.id ??
          d.studentId,
        title: "Kết quả bảo vệ đã công bố",
        content:
          "Khoa đã công bố điểm tổng kết. Vui lòng xem kết quả và yêu cầu chỉnh sửa sau bảo vệ.",
        status: "SENT",
        read: false,
      }),
    );
  });
}
