import { assert, mutate, now, uid } from "../../../shared/data/store";
import type { Committee, Defense, DemoDb } from "../../../shared/data/types";
import { defenseReadiness } from "../../guidance/services/guidance-service";
import { hasEligibleGpa } from "../../../shared/utils/gpa";

export function eligibilityFor(db: DemoDb, termId: string, studentId: string) {
  const term = db.terms.find((t) => t.id === termId);
  const student = db.students.find((s) => s.id === studentId);
  const topic = db.topics.find(
    (t) => t.termId === termId && t.studentId === studentId,
  );
  const readiness = defenseReadiness(db, termId, studentId);
  const tasks = readiness.tasks;
  const passed = readiness.pass;
  const rate = tasks.length ? passed / tasks.length : 0;
  const required = term?.parameters.min_weekly_pass_rate ?? 0.8;
  const final = db.finals.find(
    (f) => f.termId === termId && f.studentId === studentId,
  );
  const checks = [
    {
      name: "Điều kiện học vụ",
      pass:
        !!student?.eligible &&
        hasEligibleGpa(student?.gpa, term?.parameters.passing_gpa_threshold ?? 2),
      detail: `GPA ${student?.gpa ?? "—"} / ngưỡng ${term?.parameters.passing_gpa_threshold ?? 2}; trạng thái đủ điều kiện học vụ`,
    },
    {
      name: "GVHD thống nhất đề tài",
      pass: !!topic?.advisorAgreed,
      detail: "Xác nhận độc lập với duyệt đề cương của Khoa",
    },
    {
      name: "Đề cương được duyệt",
      pass: !!topic && ["APPROVED", "LOCKED"].includes(topic.status),
      detail: topic?.status ?? "Chưa có đề cương",
    },
    {
      name: "Toàn bộ nhiệm vụ đã hoàn thành và đánh giá",
      pass: tasks.length > 0 && readiness.completed === tasks.length,
      detail: `${readiness.completed}/${tasks.length} nhiệm vụ đạt 100% và đã có đánh giá Đạt/Không đạt cuối cùng; bài cần sửa phải nộp lại`,
    },
    {
      name: "Báo cáo tuần đạt yêu cầu",
      pass: tasks.length > 0 && rate >= required,
      detail: `${passed}/${tasks.length} nhiệm vụ đạt (${Math.round(rate * 100)}%); yêu cầu ${Math.round(required * 100)}%`,
    },
    {
      name: "PDF final và xác nhận GVHD",
      pass: !!final?.confirmed,
      detail: final
        ? `${final.file.name} · ${final.confirmed ? "GVHD đã xác nhận" : "Chờ xác nhận"}`
        : "Chưa nộp PDF cuối cùng",
    },
    {
      name: "Không bảo lưu trong đợt",
      pass: !db.deferments.some(
        (d) =>
          d.termId === termId &&
          d.studentId === studentId &&
          d.status === "APPROVED",
      ),
      detail: "Sinh viên đã được bảo lưu không đưa vào lịch bảo vệ",
    },
  ];
  return {
    studentId,
    eligible: checks.every((c) => c.pass),
    checks,
    reasons: checks.filter((c) => !c.pass).map((c) => c.name),
  };
}

function editable(db: DemoDb, termId: string) {
  const term = db.terms.find((t) => t.id === termId);
  assert(term, "Không tìm thấy đợt.");
  assert(
    !term.locked && !term.resultsPublished,
    "Đợt đã khóa hoặc đã công bố kết quả.",
  );
  return term;
}

export function requestDeferment(
  termId: string,
  studentId: string,
  reason: string,
  mode: "STANDARD" | "AFTER_REVIEW" = "STANDARD",
) {
  return mutate("Đề nghị bảo lưu", ["STUDENT", "FACULTY"], (db, user) => {
    const term = editable(db, termId);
    assert(
      user.roles.includes("FACULTY") || user.studentId === studentId,
      "Chỉ được lập đề nghị của chính mình.",
      "FORBIDDEN",
    );
    assert(term.studentIds.includes(studentId), "Sinh viên không thuộc đợt.");
    assert(
      reason.trim().length >= 10,
      "Vui lòng nêu lý do bảo lưu ít nhất 10 ký tự.",
    );
    assert(
      !db.deferments.some(
        (d) =>
          d.termId === termId &&
          d.studentId === studentId &&
          d.status !== "REJECTED",
      ),
      "Đã có đề nghị đang chờ hoặc đã duyệt.",
    );
    const defense = db.defenses.find(
      (d) => d.termId === termId && d.studentId === studentId,
    );
    const reviewerScore = db.scores.find(
      (s) =>
        s.termId === termId &&
        s.studentId === studentId &&
        s.kind === "REVIEWER" &&
        s.lecturerId === defense?.reviewerId &&
        s.status !== "DRAFT",
    );
    assert(
      mode !== "AFTER_REVIEW" || (defense && reviewerScore),
      "Bảo lưu sau phản biện cần phân công GVPB và phiếu phản biện đã gửi.",
    );
    assert(
      mode !== "AFTER_REVIEW" ||
        !db.scores.some(
          (s) =>
            s.termId === termId &&
            s.studentId === studentId &&
            s.kind === "COMMITTEE" &&
            s.status !== "DRAFT",
        ),
      "Sinh viên đã có điểm hội đồng, không thuộc nhánh chưa bảo vệ.",
    );
    db.deferments.unshift({
      id: uid("bl"),
      termId,
      studentId,
      reason: reason.trim(),
      status: "PENDING",
      decision: "",
      mode,
      stage: mode === "AFTER_REVIEW" ? "CHO_GVPB" : "DA_NOP_DON",
      reviewerLecturerId: defense?.reviewerId,
      reviewerScoreId: reviewerScore?.id,
      reviewerScore: reviewerScore?.total,
      reviewerComment: reviewerScore?.comment,
      sourceTopicId: db.topics.find(
        (t) => t.termId === termId && t.studentId === studentId,
      )?.id,
      submittedAt: mode === "STANDARD" ? now() : undefined,
    });
  });
}

export function decideDeferment(
  id: string,
  status: "APPROVED" | "REJECTED",
  decision: string,
) {
  return mutate("Xét đề nghị bảo lưu", ["FACULTY"], (db) => {
    const item = db.deferments.find((d) => d.id === id);
    assert(item, "Không tìm thấy đề nghị.");
    editable(db, item.termId);
    assert(item.status === "PENDING", "Đề nghị đã được xử lý.");
    assert(
      item.mode !== "AFTER_REVIEW" || item.stage === "DA_NOP_DON",
      "Cần GVPB đồng ý và sinh viên nộp đơn trước khi Khoa xét.",
    );
    assert(decision.trim().length >= 5, "Cần nhập nội dung quyết định.");
    item.status = status;
    item.decision = decision.trim();
    item.stage = status === "APPROVED" ? "KHOA_DUYET" : "TU_CHOI";
    if (status === "APPROVED") {
      assert(
        !db.scores.some(
          (s) =>
            s.termId === item.termId &&
            s.studentId === item.studentId &&
            s.status === "LOCKED",
        ),
        "Không bảo lưu sau khi điểm đã chốt.",
      );
      db.defenses = db.defenses.filter(
        (d) => d.termId !== item.termId || d.studentId !== item.studentId,
      );
    }
  });
}

export function confirmDefermentReview(
  id: string,
  agreed: boolean,
  comment: string,
) {
  return mutate(
    "GVPB xác nhận đề nghị bảo lưu",
    ["LECTURER", "COMMITTEE"],
    (db, user) => {
      const item = db.deferments.find((d) => d.id === id);
      assert(item, "Không tìm thấy đề nghị.");
      editable(db, item.termId);
      assert(
        item.status === "PENDING" && item.stage === "CHO_GVPB",
        "Đề nghị không ở trạng thái chờ GVPB.",
      );
      assert(
        item.reviewerLecturerId === user.lecturerId,
        "Bạn không phải GVPB của hồ sơ bảo lưu.",
        "FORBIDDEN",
      );
      assert(comment.trim().length >= 10, "Nhận xét GVPB tối thiểu 10 ký tự.");
      item.reviewerComment = comment.trim();
      item.stage = agreed ? "GVPB_DONG_Y" : "TU_CHOI";
      if (!agreed) {
        item.status = "REJECTED";
        item.decision = "GVPB không đồng ý bảo lưu.";
      }
    },
  );
}

export function submitDefermentApplication(id: string) {
  return mutate(
    "Nộp đơn bảo lưu sau phản biện",
    ["STUDENT", "FACULTY"],
    (db, user) => {
      const item = db.deferments.find((d) => d.id === id);
      assert(item, "Không tìm thấy đề nghị.");
      editable(db, item.termId);
      assert(
        user.roles.includes("FACULTY") || user.studentId === item.studentId,
        "Chỉ sinh viên của hồ sơ được nộp đơn.",
        "FORBIDDEN",
      );
      assert(
        item.status === "PENDING" && item.stage === "GVPB_DONG_Y",
        "Cần GVPB đồng ý trước khi nộp đơn.",
      );
      item.stage = "DA_NOP_DON";
      item.submittedAt = now();
    },
  );
}

export function resumeDeferment(id: string, targetTermId: string) {
  return mutate("Tiếp tục đồ án ở đợt mới", ["FACULTY"], (db) => {
    const item = db.deferments.find((d) => d.id === id);
    assert(
      item && item.status === "APPROVED" && item.stage !== "DA_TIEP_TUC",
      "Cần hồ sơ bảo lưu đã duyệt và chưa tiếp tục.",
    );
    const target = editable(db, targetTermId);
    assert(target.id !== item.termId, "Chọn một đợt khác đợt bảo lưu.");
    const student = db.students.find((s) => s.id === item.studentId);
    assert(
      student?.eligible &&
        hasEligibleGpa(student.gpa, target.parameters.passing_gpa_threshold ?? 2),
      "Sinh viên chưa đủ điều kiện học vụ khi trở lại.",
    );
    assert(
      !db.topics.some(
        (t) => t.termId === target.id && t.studentId === item.studentId,
      ),
      "Sinh viên đã có hồ sơ đề tài ở đợt tiếp tục.",
    );
    const old = db.topics.find((t) => t.id === item.sourceTopicId);
    assert(old, "Không tìm thấy đề tài nguồn.");
    assert(
      target.lecturers.some((l) => l.lecturerId === old.lecturerId),
      "GVHD cũ chưa tham gia đợt mới. Hãy cập nhật danh sách giảng viên trước.",
    );
    assert(
      db.assignments.filter(
        (a) => a.termId === target.id && a.lecturerId === old.lecturerId,
      ).length <
        (target.lecturers.find((l) => l.lecturerId === old.lecturerId)?.quota ??
          0),
      "GVHD đã đầy quota tại đợt mới.",
    );
    if (!target.studentIds.includes(item.studentId))
      target.studentIds.push(item.studentId);
    db.assignments.push({
      id: uid("pc"),
      termId: target.id,
      studentId: item.studentId,
      lecturerId: old.lecturerId,
      preference: 4,
      manual: true,
      reason: `Tiếp tục hồ sơ bảo lưu ${item.id} từ ${item.termId}`,
      published: true,
    });
    db.topics.push({
      ...structuredClone(old),
      id: uid("dt"),
      termId: target.id,
      status: "DRAFT",
      advisorAgreed: false,
      groupId: "",
      comment: `Hồ sơ tiếp tục từ ${item.termId}; liên kết bảo lưu ${item.id}. Cần đánh giá, duyệt lại.`,
      versions: [],
    });
    item.carryOverTermId = target.id;
    item.stage = "DA_TIEP_TUC";
  });
}

export function saveCommittee(input: Committee) {
  return mutate("Lưu hội đồng bảo vệ", ["FACULTY"], (db) => {
    const term = editable(db, input.termId);
    assert(
      input.name.trim() && input.room.trim(),
      "Tên hội đồng và phòng là bắt buộc.",
    );
    assert(
      input.members.length >= 3 && input.members.length <= 5,
      "Hội đồng gồm từ 3 đến 5 giảng viên.",
    );
    assert(
      new Set(input.members.map((m) => m.lecturerId)).size ===
        input.members.length,
      "Các thành viên phải là giảng viên khác nhau.",
    );
    assert(
      input.members.filter((m) => m.role === "CHAIR").length === 1 &&
        input.members.filter((m) => m.role === "SECRETARY").length === 1,
      "Cần đúng một chủ tịch và một thư ký.",
    );
    assert(
      input.members.every((m) =>
        term.lecturers.some((l) => l.lecturerId === m.lecturerId),
      ),
      "Thành viên phải tham gia đợt.",
    );
    const related = db.defenses.filter((d) => d.committeeId === input.id);
    for (const defense of related) {
      const advisor = db.assignments.find(
        (a) => a.termId === input.termId && a.studentId === defense.studentId,
      )?.lecturerId;
      assert(
        !input.members.some((m) => m.lecturerId === advisor),
        "Hội đồng có GVHD của sinh viên đã được xếp lịch.",
      );
      assert(
        !db.scores.some(
          (s) =>
            s.termId === input.termId &&
            s.studentId === defense.studentId &&
            s.kind === "COMMITTEE",
        ),
        "Hội đồng đã có điểm; không thay đổi thành viên.",
      );
    }
    const item = {
      ...input,
      id: input.id || uid("hd"),
      name: input.name.trim(),
      room: input.room.trim(),
    };
    const index = db.committees.findIndex((c) => c.id === item.id);
    if (index < 0) db.committees.push(item);
    else db.committees[index] = item;
    db.defenses
      .filter((d) => d.termId === input.termId)
      .forEach((d) =>
        validateAssignment(
          db,
          d.termId,
          d.studentId,
          d.committeeId,
          d.reviewerId,
        ),
      );
    db.defenses
      .filter((d) => d.termId === input.termId && d.date)
      .forEach((d) =>
        assert(
          !scheduleConflicts(db, d).length,
          "Thay đổi thành viên tạo xung đột lịch giảng viên.",
        ),
      );
    return item;
  });
}

export function validateAssignment(
  db: DemoDb,
  termId: string,
  studentId: string,
  committeeId: string,
  reviewerId: string,
) {
  const advisor = db.assignments.find(
    (a) => a.termId === termId && a.studentId === studentId,
  )?.lecturerId;
  const committee = db.committees.find(
    (c) => c.id === committeeId && c.termId === termId,
  );
  assert(advisor && committee, "Cần có GVHD và hội đồng hợp lệ.");
  assert(
    reviewerId &&
      db.terms
        .find((t) => t.id === termId)
        ?.lecturers.some((l) => l.lecturerId === reviewerId),
    "Chọn giảng viên phản biện tham gia đợt.",
  );
  assert(
    reviewerId !== advisor,
    "GVHD không được phản biện sinh viên mình hướng dẫn.",
  );
  assert(
    !committee.members.some((m) => m.lecturerId === advisor),
    "GVHD không được ngồi hội đồng chấm sinh viên mình hướng dẫn.",
  );
  assert(
    !db.committees.some(
      (c) =>
        c.termId === termId &&
        c.members.some((m) => m.lecturerId === advisor) &&
        c.members.some((m) => m.lecturerId === reviewerId),
    ),
    "GVPB thuộc hội đồng có GVHD của sinh viên; hãy chọn giảng viên khác.",
  );
  return committee;
}

export function assignReviewer(
  termId: string,
  studentId: string,
  committeeId: string,
  reviewerId: string,
) {
  return mutate("Phân công phản biện và hội đồng", ["FACULTY"], (db) => {
    editable(db, termId);
    assert(
      eligibilityFor(db, termId, studentId).eligible,
      "Sinh viên chưa đủ điều kiện bảo vệ.",
    );
    const committee = validateAssignment(
      db,
      termId,
      studentId,
      committeeId,
      reviewerId,
    );
    assert(
      !db.scores.some(
        (s) =>
          s.termId === termId &&
          s.studentId === studentId &&
          s.kind !== "ADVISOR",
      ),
      "Đã có phiếu phản biện/hội đồng, không thay đổi phân công.",
    );
    const existing = db.defenses.find(
      (d) => d.termId === termId && d.studentId === studentId,
    );
    if (existing) {
      existing.committeeId = committeeId;
      existing.reviewerId = reviewerId;
      existing.date = "";
      existing.start = "";
      existing.end = "";
      existing.reviewerPublished = false;
      existing.schedulePublished = false;
    } else
      db.defenses.push({
        id: uid("bv"),
        termId,
        studentId,
        committeeId,
        reviewerId,
        date: "",
        start: "",
        end: "",
        room: committee.room,
        order: 1,
        minutes: "",
        revision: "",
        reviewerPublished: false,
        schedulePublished: false,
      });
  });
}

export function scheduleConflicts(db: DemoDb, item: Defense): string[] {
  const conflicts: string[] = [];
  const actorIds = (d: Defense) =>
    [
      ...(db.committees
        .find((c) => c.id === d.committeeId)
        ?.members.map((m) => m.lecturerId) ?? []),
      d.reviewerId,
      db.assignments.find(
        (a) => a.termId === d.termId && a.studentId === d.studentId,
      )?.lecturerId,
    ].filter(Boolean);
  const actors = actorIds(item);
  db.defenses
    .filter(
      (d) =>
        d.id !== item.id &&
        d.date === item.date &&
        d.start < item.end &&
        item.start < d.end,
    )
    .forEach((d) => {
      if (d.room.trim().toLowerCase() === item.room.trim().toLowerCase())
        conflicts.push(`Phòng ${item.room} đã có phiên ${d.start}–${d.end}.`);
      if (actorIds(d).some((id) => actors.includes(id)))
        conflicts.push(
          `Giảng viên/GVHD trùng lịch với ${db.students.find((s) => s.id === d.studentId)?.name ?? d.studentId}.`,
        );
    });
  return [...new Set(conflicts)];
}

export function saveSchedule(input: Defense) {
  return mutate("Lập lịch bảo vệ", ["FACULTY"], (db) => {
    editable(db, input.termId);
    const original = db.defenses.find((d) => d.id === input.id);
    assert(original, "Cần phân công phản biện trước khi lập lịch.");
    assert(
      original.termId === input.termId &&
        original.studentId === input.studentId &&
        original.committeeId === input.committeeId &&
        original.reviewerId === input.reviewerId,
      "Không thay đổi hồ sơ hay phân công qua thao tác xếp lịch.",
    );
    assert(
      !db.scores.some(
        (s) =>
          s.termId === input.termId &&
          s.studentId === input.studentId &&
          s.kind === "COMMITTEE" &&
          s.status !== "DRAFT",
      ),
      "Đã có điểm hội đồng, không thay đổi lịch bảo vệ.",
    );
    assert(
      eligibilityFor(db, input.termId, input.studentId).eligible,
      "Sinh viên chưa đủ điều kiện bảo vệ.",
    );
    validateAssignment(
      db,
      input.termId,
      input.studentId,
      input.committeeId,
      input.reviewerId,
    );
    assert(
      /^\d{4}-\d{2}-\d{2}$/.test(input.date) &&
        /^\d{2}:\d{2}$/.test(input.start) &&
        /^\d{2}:\d{2}$/.test(input.end) &&
        input.start < input.end,
      "Ngày và giờ bắt đầu/kết thúc không hợp lệ.",
    );
    assert(input.room.trim(), "Nhập phòng bảo vệ.");
    const conflicts = scheduleConflicts(db, input);
    assert(!conflicts.length, conflicts.join(" "), "SCHEDULE_CONFLICT");
    assert(
      Number.isInteger(input.order) && input.order > 0,
      "Thứ tự bảo vệ phải là số nguyên dương.",
    );
    Object.assign(original, {
      date: input.date,
      start: input.start,
      end: input.end,
      room: input.room.trim(),
      order: input.order,
      schedulePublished: false,
    });
  });
}

export function alphabetKey(name: string) {
  const pieces = name.trim().split(/\s+/);
  return `${pieces.pop() ?? ""} ${pieces.join(" ")}`;
}
export function sortDefenseOrder(termId: string) {
  return mutate("Xếp thứ tự Tên + Họ đệm", ["FACULTY"], (db) => {
    editable(db, termId);
    assert(
      !db.scores.some(
        (s) =>
          s.termId === termId && s.kind === "COMMITTEE" && s.status !== "DRAFT",
      ),
      "Đã có điểm hội đồng, không xếp lại thứ tự bảo vệ.",
    );
    const sessions = new Map<string, Defense[]>();
    db.defenses
      .filter((d) => d.termId === termId && d.date)
      .forEach((d) => {
        const key = `${d.committeeId}|${d.date}|${d.start < "12:00" ? "AM" : "PM"}`;
        sessions.set(key, [...(sessions.get(key) ?? []), d]);
      });
    sessions.forEach((items) => {
      const slots = [...items]
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((d) => ({ start: d.start, end: d.end }));
      items
        .sort((a, b) =>
          alphabetKey(
            db.students.find((s) => s.id === a.studentId)?.name ?? "",
          ).localeCompare(
            alphabetKey(
              db.students.find((s) => s.id === b.studentId)?.name ?? "",
            ),
            "vi",
          ),
        )
        .forEach((d, i) => {
          d.order = i + 1;
          d.start = slots[i].start;
          d.end = slots[i].end;
          d.schedulePublished = false;
        });
    });
    for (const item of db.defenses.filter((d) => d.termId === termId && d.date))
      assert(
        !scheduleConflicts(db, item).length,
        "Xếp thứ tự tạo xung đột với lịch giảng viên; cần điều chỉnh khung giờ.",
      );
  });
}

export function publishReviewerAssignments(termId: string) {
  return mutate("Chốt và công bố phân công phản biện", ["FACULTY"], (db) => {
    editable(db, termId);
    const items = db.defenses.filter(
      (d) => d.termId === termId && d.reviewerPublished === false,
    );
    assert(items.length, "Không có phân công nháp để công bố.");
    items.forEach((d) => {
      validateAssignment(db, termId, d.studentId, d.committeeId, d.reviewerId);
      assert(
        eligibilityFor(db, termId, d.studentId).eligible,
        "Có hồ sơ không còn đủ điều kiện.",
      );
      d.reviewerPublished = true;
      db.notifications.unshift({
        id: uid("tb"),
        termId,
        userId:
          db.accounts.find((a) => a.lecturerId === d.reviewerId)?.id ??
          d.reviewerId,
        title: "Phân công phản biện đồ án",
        content: `Bạn được phân công đọc duyệt hồ sơ sinh viên ${db.students.find((s) => s.id === d.studentId)?.name}.`,
        status: "SENT",
        read: false,
      });
    });
  });
}

export function publishDefenseSchedule(termId: string) {
  return mutate("Công bố lịch bảo vệ", ["FACULTY"], (db) => {
    editable(db, termId);
    const items = db.defenses.filter(
      (d) => d.termId === termId && d.date && d.schedulePublished === false,
    );
    assert(items.length, "Không có lịch nháp để công bố.");
    items.forEach((d) => {
      assert(
        d.reviewerPublished !== false,
        "Cần công bố phân công phản biện trước.",
      );
      assert(
        eligibilityFor(db, termId, d.studentId).eligible,
        "Có sinh viên không còn đủ điều kiện bảo vệ.",
      );
      validateAssignment(db, termId, d.studentId, d.committeeId, d.reviewerId);
      assert(!scheduleConflicts(db, d).length, "Có lịch bị xung đột.");
      d.schedulePublished = true;
      const recipients = [
        db.accounts.find((a) => a.studentId === d.studentId)?.id,
        ...(db.committees
          .find((c) => c.id === d.committeeId)
          ?.members.map(
            (m) => db.accounts.find((a) => a.lecturerId === m.lecturerId)?.id,
          ) ?? []),
        db.accounts.find((a) => a.lecturerId === d.reviewerId)?.id,
      ];
      [...new Set(recipients.filter((id): id is string => !!id))].forEach(
        (userId) =>
          db.notifications.unshift({
            id: uid("tb"),
            termId,
            userId,
            title: "Lịch bảo vệ chính thức",
            content: `Sinh viên ${db.students.find((s) => s.id === d.studentId)?.name}: ${d.date}, ${d.start}–${d.end}, phòng ${d.room}.`,
            status: "SENT",
            read: false,
          }),
      );
    });
  });
}

export function saveMinutes(id: string, minutes: string, revision: string) {
  return mutate(
    "Lưu biên bản và yêu cầu chỉnh sửa",
    ["FACULTY", "COMMITTEE", "LECTURER"],
    (db, user) => {
      const item = db.defenses.find((d) => d.id === id);
      assert(item, "Không tìm thấy phiên bảo vệ.");
      editable(db, item.termId);
      const committee = db.committees.find((c) => c.id === item.committeeId);
      assert(
        user.roles.includes("FACULTY") ||
          committee?.members.some(
            (m) =>
              m.lecturerId === user.lecturerId &&
              ["CHAIR", "SECRETARY"].includes(m.role),
          ),
        "Chỉ giáo vụ, chủ tịch hoặc thư ký hội đồng được sửa biên bản.",
        "FORBIDDEN",
      );
      assert(
        minutes.trim().length >= 10,
        "Nội dung biên bản tối thiểu 10 ký tự.",
      );
      item.minutes = minutes.trim();
      item.revision = revision.trim();
    },
  );
}
