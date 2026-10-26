import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Confirm,
  DataBoundary,
  DataTable,
  Modal,
  Notice,
  PageHeader,
  Stat,
} from "../../../shared/components/kit";
import type { DemoDb } from "../../../shared/data/types";
import { useDefenseScope } from "../../defense/components/DefenseScope";
import {
  aggregateResult,
  lockResults,
  publishResults,
} from "../services/grading-service";
import { exportExcel } from "../../../shared/services/export-service";
const n = (value: number | null) => (value === null ? "—" : value.toFixed(2));
function Content({ db }: { db: DemoDb }) {
  const s = useDefenseScope(db);
  const [confirm, setConfirm] = useState<"lock" | "publish">();
  const [detail, setDetail] = useState("");
  const [status, setStatus] = useState("");
  const student = s.user?.roles.includes("STUDENT");
  const canSee = !student || s.term.resultsPublished;
  const all = s.term.studentIds
    .filter(s.visible)
    .map((id) => ({ id, ...aggregateResult(db, s.term.id, id) }));
  const rows = canSee
    ? all.filter(
        (r) =>
          !status ||
          (status === "MISSING"
            ? !r.complete
            : status === "PASS"
              ? r.passed
              : r.complete && !r.passed),
      )
    : [];
  const selected = all.find((r) => r.id === detail);
  const p = s.term.parameters;
  return (
    <>
      <PageHeader
        title={
          student ? "Kết quả đồ án của tôi" : "Tổng hợp và công bố kết quả"
        }
        description="Điểm quá trình, điểm kết thúc học phần và điểm học phần được tổng hợp theo tham số đợt."
        actions={
          s.faculty && (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  s.exec(() =>
                    exportExcel(
                      "Bảng điểm bảo vệ",
                      rows.map((r) => ({
                        "Mã SV": db.students.find((x) => x.id === r.id)?.code,
                        "Họ tên": s.name(r.id),
                        GVHD: r.advisor,
                        GVPB: r.reviewer,
                        QT: r.process,
                        KTHP: r.defenseScore,
                        HP: r.total,
                        "Kết quả": r.complete
                          ? r.passed
                            ? "Đạt"
                            : "Không đạt"
                          : "Chưa đủ điểm",
                        "Yêu cầu sửa": r.revision,
                      })),
                    ),
                  )
                }
              >
                Tải Excel
              </Button>
              <Button
                variant="secondary"
                disabled={s.term.resultsPublished}
                onClick={() => setConfirm("lock")}
              >
                Chốt bảng điểm
              </Button>
              <Button
                disabled={s.term.resultsPublished}
                onClick={() => setConfirm("publish")}
              >
                {s.term.resultsPublished ? "Đã công bố" : "Công bố kết quả"}
              </Button>
            </>
          )
        }
      />
      <Notice>
        QT = GVHD × {p.advisor_weight_in_process ?? 0.5} + GVPB ×{" "}
        {p.reviewer_weight_in_process ?? 0.5}; KTHP = trung bình điểm các thành
        viên HĐ; HP = QT × {p.process_weight ?? 0.4} + KTHP ×{" "}
        {p.committee_weight ?? 0.6}. Điều kiện đạt: QT, KTHP và HP đều ≥{" "}
        {p.min_pass_score ?? 5}. Chỉ tính phiếu đã gửi hoặc đã chốt.
      </Notice>
      {!canSee ? (
        <Card>
          <Notice tone="warning">
            Khoa chưa công bố kết quả của đợt. Điểm sẽ xuất hiện sau khi bảng
            điểm được chốt và công bố.
          </Notice>
        </Card>
      ) : (
        <>
          <div className="stats-grid">
            <Stat
              label="Đủ thành phần điểm"
              value={all.filter((r) => r.complete).length}
            />
            <Stat
              label="Đạt yêu cầu"
              value={all.filter((r) => r.passed).length}
            />
            <Stat
              label="Trạng thái công bố"
              value={
                <Badge
                  value={s.term.resultsPublished ? "COMPLETED" : "DRAFT"}
                />
              }
            />
          </div>
          <Card title="Bảng tổng hợp kết quả">
            <DataTable
              rows={rows}
              searchText={(r) =>
                `${s.name(r.id)} ${db.students.find((x) => x.id === r.id)?.code}`
              }
              filters={
                <select
                  aria-label="Lọc kết quả"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Tất cả kết quả</option>
                  <option value="MISSING">Thiếu điểm</option>
                  <option value="PASS">Đạt</option>
                  <option value="FAIL">Không đạt</option>
                </select>
              }
              columns={[
                {
                  key: "student",
                  title: "Sinh viên",
                  render: (r) => (
                    <div className="font-medium">
                      {s.name(r.id)}
                      <small className="block muted">
                        {db.students.find((x) => x.id === r.id)?.code}
                      </small>
                    </div>
                  ),
                },
                { key: "advisor", title: "GVHD", render: (r) => n(r.advisor) },
                {
                  key: "reviewer",
                  title: "GVPB",
                  render: (r) => n(r.reviewer),
                },
                { key: "process", title: "QT", render: (r) => n(r.process) },
                {
                  key: "committee",
                  title: "KTHP",
                  render: (r) => n(r.defenseScore),
                },
                {
                  key: "total",
                  title: "HP",
                  render: (r) => <strong>{n(r.total)}</strong>,
                },
                {
                  key: "status",
                  title: "Kết quả",
                  render: (r) => (
                    <Badge
                      value={
                        r.complete ? (r.passed ? "PASS" : "FAIL") : "PENDING"
                      }
                    />
                  ),
                },
                {
                  key: "state",
                  title: "Trạng thái",
                  render: (r) => (
                    <Badge
                      value={
                        r.published
                          ? "COMPLETED"
                          : r.locked
                            ? "LOCKED"
                            : "DRAFT"
                      }
                    />
                  ),
                },
                {
                  key: "action",
                  title: "",
                  render: (r) => (
                    <Button variant="ghost" onClick={() => setDetail(r.id)}>
                      Chi tiết
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
      {selected && canSee && (
        <Modal
          title={`Kết quả · ${s.name(selected.id)}`}
          onClose={() => setDetail("")}
        >
          <div className="space-y-3">
            <p>
              Điểm GVHD: <strong>{n(selected.advisor)}</strong> · GVPB:{" "}
              <strong>{n(selected.reviewer)}</strong>
            </p>
            {selected.committeeScores.map((x) => (
              <div className="flex justify-between" key={x.id}>
                <span>{s.lecturer(x.lecturerId)}</span>
                <strong>
                  {n(x.total)} <Badge value={x.status} />
                </strong>
              </div>
            ))}
            <Notice
              tone={
                selected.complete
                  ? selected.passed
                    ? "success"
                    : "danger"
                  : "warning"
              }
            >
              {selected.complete
                ? `Điểm học phần: ${n(selected.total)} — ${selected.passed ? "Đạt" : "Không đạt"}`
                : `Thiếu: ${selected.missing.join(", ")}`}
            </Notice>
            <h3 className="font-semibold">Yêu cầu chỉnh sửa sau bảo vệ</h3>
            <p>{selected.revision || "Không có yêu cầu được ghi nhận."}</p>
          </div>
        </Modal>
      )}
      {confirm && (
        <Confirm
          title={
            confirm === "lock"
              ? "Chốt bảng điểm đợt?"
              : "Công bố kết quả đến sinh viên?"
          }
          description={
            confirm === "lock"
              ? "Tất cả hồ sơ đã xếp lịch phải có đầy đủ phiếu điểm đã gửi. Điểm đã chốt được bảo toàn để công bố."
              : "Chỉ công bố khi mọi thành phần điểm đã chốt. Sinh viên sẽ xem được kết quả và nhận thông báo."
          }
          onClose={() => setConfirm(undefined)}
          pending={s.pending}
          onConfirm={() =>
            s.exec(() => {
              if (confirm === "lock") lockResults(s.term.id);
              else publishResults(s.term.id);
              setConfirm(undefined);
            })
          }
        />
      )}
    </>
  );
}
export default function ResultPage() {
  return <DataBoundary>{(db) => <Content db={db} />}</DataBoundary>;
}
