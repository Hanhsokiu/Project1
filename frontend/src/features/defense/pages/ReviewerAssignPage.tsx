import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  DataBoundary,
  DataTable,
  Field,
  Modal,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import type { DemoDb } from "../../../shared/data/types";
import { useDefenseScope } from "../components/DefenseScope";
import {
  assignReviewer,
  eligibilityFor,
  publishReviewerAssignments,
} from "../services/defense-service";
function Content({ db }: { db: DemoDb }) {
  const s = useDefenseScope(db);
  const [student, setStudent] = useState("");
  const [committee, setCommittee] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [onlyEligible, setOnlyEligible] = useState(false);
  const rows = s.term.studentIds
    .filter(s.visible)
    .map((id) => ({
      id,
      eligible: eligibilityFor(db, s.term.id, id).eligible,
      defense: s.defenses.find((d) => d.studentId === id),
    }))
    .filter((x) => !onlyEligible || x.eligible);
  return (
    <>
      <PageHeader
        title="Phân công giảng viên phản biện"
        description="Phân công độc lập với GVHD, kiểm soát xung đột lợi ích giữa giảng viên và hội đồng."
        actions={
          s.faculty && (
            <Button
              disabled={
                s.pending ||
                !s.defenses.some((d) => d.reviewerPublished === false)
              }
              onClick={() =>
                s.exec(() => publishReviewerAssignments(s.term.id))
              }
            >
              Chốt và thông báo GVPB
            </Button>
          )
        }
      />
      <Notice tone="warning">
        GVHD không phản biện hoặc chấm sinh viên của mình. Giảng viên thuộc hội
        đồng có GVHD của sinh viên cũng không được nhận phản biện hồ sơ đó.
      </Notice>
      <Card
        title="Hồ sơ bảo vệ"
        description="Chỉ sinh viên đủ điều kiện có thể được phân công."
      >
        <DataTable
          rows={rows}
          searchText={(r) => s.name(r.id)}
          filters={
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={onlyEligible}
                onChange={(e) => setOnlyEligible(e.target.checked)}
              />{" "}
              Chỉ đủ điều kiện
            </label>
          }
          columns={[
            { key: "student", title: "Sinh viên", render: (r) => s.name(r.id) },
            {
              key: "advisor",
              title: "Giảng viên hướng dẫn",
              render: (r) =>
                s.lecturer(
                  db.assignments.find(
                    (a) => a.termId === s.term.id && a.studentId === r.id,
                  )?.lecturerId ?? "",
                ),
            },
            {
              key: "condition",
              title: "Điều kiện",
              render: (r) => <Badge value={r.eligible ? "PASS" : "REVISION"} />,
            },
            {
              key: "reviewer",
              title: "Phản biện / Hội đồng",
              render: (r) => (
                <div>
                  {s.lecturer(r.defense?.reviewerId ?? "")}
                  <small className="block muted">
                    {r.defense
                      ? s.committeeName(r.defense)
                      : "Chưa xếp hội đồng"}
                  </small>
                </div>
              ),
            },
            {
              key: "published",
              title: "Thông báo",
              render: (r) =>
                r.defense ? (
                  <Badge
                    value={
                      r.defense.reviewerPublished === false ? "DRAFT" : "SENT"
                    }
                  />
                ) : null,
            },
            {
              key: "action",
              title: "",
              render: (r) =>
                s.faculty && (
                  <Button
                    variant="secondary"
                    disabled={!r.eligible}
                    onClick={() => {
                      setStudent(r.id);
                      setCommittee(
                        r.defense?.committeeId ??
                          db.committees.find((c) => c.termId === s.term.id)
                            ?.id ??
                          "",
                      );
                      setReviewer(r.defense?.reviewerId ?? "");
                    }}
                  >
                    Phân công
                  </Button>
                ),
            },
          ]}
        />
      </Card>
      <Card title="Tải phản biện trong đợt">
        <div className="grid gap-3 md:grid-cols-3">
          {s.term.lecturers.map((l) => (
            <div className="rounded-lg border p-3" key={l.lecturerId}>
              <strong>{s.lecturer(l.lecturerId)}</strong>
              <p className="muted text-sm mt-1">
                {s.defenses.filter((d) => d.reviewerId === l.lecturerId).length}{" "}
                hồ sơ phản biện
              </p>
            </div>
          ))}
        </div>
      </Card>
      {student && (
        <Modal
          title={`Phân công · ${s.name(student)}`}
          onClose={() => setStudent("")}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              s.exec(() => {
                assignReviewer(s.term.id, student, committee, reviewer);
                setStudent("");
              });
            }}
          >
            <Field label="Hội đồng bảo vệ">
              <select
                required
                value={committee}
                onChange={(e) => setCommittee(e.target.value)}
              >
                <option value="">Chọn hội đồng</option>
                {db.committees
                  .filter((c) => c.termId === s.term.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Giảng viên phản biện">
              <select
                required
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
              >
                <option value="">Chọn giảng viên</option>
                {s.term.lecturers.map((l) => (
                  <option key={l.lecturerId} value={l.lecturerId}>
                    {s.lecturer(l.lecturerId)}
                  </option>
                ))}
              </select>
            </Field>
            <Notice>
              Thay đổi phân công sẽ yêu cầu xếp lại thời gian bảo vệ. Không đổi
              phân công khi hồ sơ đã có phiếu điểm.
            </Notice>
            <div className="dialog-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStudent("")}
              >
                Hủy
              </Button>
              <Button disabled={s.pending}>Lưu phân công</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export default function ReviewerAssignPage() {
  return <DataBoundary>{(db) => <Content db={db} />}</DataBoundary>;
}
