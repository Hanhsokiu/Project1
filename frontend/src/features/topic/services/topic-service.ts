import {
  assert,
  mutate,
  now,
  uid,
  readDb,
  requireUser,
} from "../../../shared/data/store";
import { STEP3_API } from "../../registration/services/assignment-api";
import { topicApi } from "./topic-api";
import { proposalSchema } from "../../../shared/data/schemas";
import type { DemoDb, ReviewGroup, Topic } from "../../../shared/data/types";
export function canReview(db: DemoDb, topic: Topic, lecturerId?: string) {
  return db.reviewGroups.some(
    (g) =>
      g.id === topic.groupId &&
      g.termId === topic.termId &&
      g.lecturerIds.includes(lecturerId || ""),
  );
}
export const topicService = {
  save(
    termId: string,
    input: Pick<
      Topic,
      "title" | "objectives" | "scope" | "technology" | "expected" | "plan"
    >,
    submit: boolean,
    studentId?: string,
    expectedVersion?: number,
  ) {
    if (STEP3_API) {
      const db = readDb(),
        user = requireUser(db);
      const sid = studentId ?? user.studentId;
      assert(sid, "Chọn sinh viên được giao.");
      const t = db.topics.find(
        (t) => t.termId === termId && t.studentId === sid,
      );
      return topicApi.save(
        termId,
        sid,
        input,
        expectedVersion ?? t?.versions.slice(-1)[0]?.version ?? 0,
        submit,
      );
    }
    return mutate(
      submit ? "Nộp đề cương" : "Lưu nháp đề cương",
      ["STUDENT"],
      (db, user) => {
        const a = db.assignments.find(
          (a) =>
            a.termId === termId &&
            a.studentId === user.studentId &&
            a.published,
        );
        assert(a, "Chưa có phân công được công bố");
        const t = db.terms.find((t) => t.id === termId);
        assert(t && !t.locked, "Đợt đã khóa");
        assert(
          t.assignmentPublished &&
            ["CLOSED_REGISTRATION", "IN_PROGRESS"].includes(t.status),
          "Đợt chưa ở giai đoạn lập đề tài/đề cương",
        );
        const old = db.topics.find(
          (x) => x.termId === termId && x.studentId === user.studentId,
        );
        assert(
          !old || ["DRAFT", "REVISION", "REJECTED"].includes(old.status),
          "Đề cương đã nộp/duyệt/chốt, không thể sửa",
        );
        assert(input.title.trim().length >= 5, "Tên đề tài ít nhất 5 ký tự");
        if (submit) {
          const parsed = proposalSchema.safeParse(input);
          assert(
            parsed.success,
            parsed.success
              ? ""
              : parsed.error.issues.map((i) => i.message).join("; "),
          );
          assert(
            old?.advisorAgreed,
            "GVHD cần thống nhất đề tài trước khi nộp cho nhóm duyệt",
          );
        }
        const topic: Topic = old || {
          id: uid("dt"),
          termId,
          studentId: a.studentId,
          lecturerId: a.lecturerId,
          directionId:
            db.registrations.find(
              (r) => r.termId === termId && r.studentId === a.studentId,
            )?.directionId || "h1",
          title: "",
          objectives: "",
          scope: "",
          technology: "",
          expected: "",
          plan: [],
          versions: [],
          advisorAgreed: false,
          status: "DRAFT",
          groupId: "",
          comment: "",
        };
        const changed = topic.title !== input.title;
        if (changed) topic.advisorAgreed = false;
        Object.assign(topic, input, { status: submit ? "SUBMITTED" : "DRAFT" });
        if (submit) {
          assert(
            !changed,
            "Tên đề tài đã thay đổi; lưu nháp và xin GVHD thống nhất lại",
          );
          topic.versions.push({
            ...structuredClone(input),
            version: topic.versions.length + 1,
            at: now(),
            status: "SUBMITTED",
            comment: "",
          });
        }
        if (!old) db.topics.push(topic);
      },
    );
  },
  agree(id: string, agreed: boolean) {
    if (STEP3_API) {
      const t = readDb().topics.find((t) => t.id === id);
      assert(t, "Không tìm thấy đề tài.");
      return topicApi.agree(id, agreed, t.versions.slice(-1)[0]?.version ?? 0);
    }
    return mutate("GVHD thống nhất đề tài", ["LECTURER"], (db, user) => {
      const topic = db.topics.find((t) => t.id === id);
      assert(
        topic && topic.lecturerId === user.lecturerId,
        "Chỉ GVHD được thống nhất đề tài",
      );
      const term = db.terms.find((t) => t.id === topic.termId);
      assert(term && !term.locked, "Đợt đã khóa");
      assert(
        term.assignmentPublished &&
          ["CLOSED_REGISTRATION", "IN_PROGRESS"].includes(term.status),
        "Đợt chưa ở giai đoạn lập đề tài/đề cương",
      );
      assert(
        db.assignments.some(
          (a) =>
            a.termId === topic.termId &&
            a.studentId === topic.studentId &&
            a.lecturerId === user.lecturerId &&
            a.published,
        ),
        "Chỉ GVHD chính thức hiện tại được thống nhất đề tài",
      );
      assert(
        ["DRAFT", "REVISION", "REJECTED"].includes(topic.status),
        "Đề cương đã nộp/duyệt/chốt, không thay đổi xác nhận",
      );
      topic.advisorAgreed = agreed;
    });
  },
  saveGroup(input: Omit<ReviewGroup, "id"> & { id?: string }) {
    assert(
      !STEP3_API,
      "Nhóm duyệt thuộc UC13, chưa triển khai trong API Bước 3.",
    );
    return mutate("Lưu nhóm duyệt đề cương", ["ADMIN", "FACULTY"], (db) => {
      assert(
        input.name.trim() && input.departmentId && input.lecturerIds.length,
        "Nhập tên, bộ môn và thành viên nhóm duyệt",
      );
      assert(
        new Set(input.lecturerIds).size === input.lecturerIds.length,
        "Thành viên không được trùng",
      );
      assert(
        input.lecturerIds.every((id) =>
          db.lecturers.some(
            (l) => l.id === id && l.departmentId === input.departmentId,
          ),
        ),
        "Thành viên phải thuộc bộ môn đã chọn",
      );
      const old = db.reviewGroups.find((g) => g.id === input.id);
      if (old) Object.assign(old, input);
      else db.reviewGroups.push({ ...input, id: uid("nd") });
    });
  },
  assignGroup(topicIds: string[], groupId: string) {
    assert(
      !STEP3_API,
      "Nhóm duyệt thuộc UC13, chưa triển khai trong API Bước 3.",
    );
    return mutate(
      "Phân đề cương cho nhóm duyệt",
      ["ADMIN", "FACULTY"],
      (db) => {
        const g = db.reviewGroups.find((g) => g.id === groupId);
        assert(g, "Chọn nhóm duyệt");
        assert(topicIds.length, "Chọn ít nhất một đề cương");
        for (const id of topicIds) {
          const t = db.topics.find((t) => t.id === id);
          assert(t && t.termId === g.termId, "Đề cương không thuộc cùng đợt");
          assert(t.status === "SUBMITTED", "Chỉ phân đề cương đã nộp");
          t.groupId = groupId;
        }
      },
    );
  },
  review(
    id: string,
    status: "REVISION" | "APPROVED" | "REJECTED",
    comment: string,
  ) {
    assert(
      !STEP3_API,
      "Xét duyệt thuộc UC13, chưa triển khai trong API Bước 3.",
    );
    return mutate(
      "Xét duyệt đề cương",
      ["ADMIN", "FACULTY", "LECTURER"],
      (db, user) => {
        const t = db.topics.find((t) => t.id === id);
        assert(t, "Không tìm thấy đề cương");
        assert(
          user.roles.some((r) => r === "ADMIN" || r === "FACULTY") ||
            canReview(db, t, user.lecturerId),
          "Bạn không thuộc nhóm duyệt đề cương",
        );
        assert(t.status === "SUBMITTED", "Chỉ duyệt đề cương đang chờ");
        assert(t.advisorAgreed, "GVHD chưa thống nhất đề tài");
        assert(comment.trim().length >= 10, "Nhận xét ít nhất 10 ký tự");
        t.status = status;
        t.comment = comment;
        const v = t.versions[t.versions.length - 1];
        if (v) {
          v.comment = comment;
          v.status = status;
        }
        db.notifications.push({
          id: uid("tb"),
          termId: t.termId,
          userId: t.studentId,
          title: "Kết quả xét duyệt đề cương",
          content: comment,
          status: "SENT",
          read: false,
        });
      },
    );
  },
  lock(id: string) {
    assert(
      !STEP3_API,
      "Chốt hồ sơ thuộc UC13, chưa triển khai trong API Bước 3.",
    );
    return mutate("Chốt hồ sơ đề tài", ["ADMIN", "FACULTY"], (db) => {
      const t = db.topics.find((t) => t.id === id);
      assert(t?.status === "APPROVED", "Chỉ chốt đề cương đã duyệt");
      t.status = "LOCKED";
    });
  },
};
export type TopicService = typeof topicService;
