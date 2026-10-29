import { Save, Eye, X, Send, Plus, Download } from "lucide-react";
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
import type { Deferment, DemoDb } from "../../../shared/data/types";
import { exportPdf } from "../../../shared/services/export-service";
import { useDefenseScope } from "../components/DefenseScope";
import {
  confirmDefermentReview,
  decideDeferment,
  requestDeferment,
  resumeDeferment,
  submitDefermentApplication,
} from "../services/defense-service";
const stages: Record<string, string> = {
  CHO_GVPB: "Chờ GVPB xác nhận",
  GVPB_DONG_Y: "GVPB đồng ý · chờ nộp đơn",
  TU_CHOI: "Đã từ chối",
  DA_NOP_DON: "Đã nộp đơn · chờ Khoa",
  KHOA_DUYET: "Khoa đã duyệt",
  DA_TIEP_TUC: "Đã tiếp tục ở đợt mới",
};
function Content({ db }: { db: DemoDb }) {
  const s = useDefenseScope(db);
  const [create, setCreate] = useState(false),
    [student, setStudent] = useState(""),
    [reason, setReason] = useState("");
  const [mode, setMode] = useState<"STANDARD" | "AFTER_REVIEW">("STANDARD");
  const [selected, setSelected] = useState<Deferment>(),
    [decision, setDecision] = useState(""),
    [target, setTarget] = useState("");
  const rows = db.deferments.filter(
    (d) => d.termId === s.term.id && s.visible(d.studentId),
  );
  const canCreate = s.faculty || s.user.roles.includes("STUDENT");
  const pdf = (item: Deferment) =>
    exportPdf("ĐƠN ĐỀ NGHỊ BẢO LƯU ĐỒ ÁN TỐT NGHIỆP", [
      "Kính gửi: Khoa / Bộ môn",
      `Sinh viên: ${s.name(item.studentId)}`,
      `Mã sinh viên: ${db.students.find((x) => x.id === item.studentId)?.code}`,
      `Đợt: ${s.term.name}`,
      `Lý do: ${item.reason}`,
      `Hình thức: ${item.mode === "AFTER_REVIEW" ? "Sau phản biện, chưa bảo vệ" : "Bảo lưu thông thường"}`,
      `GVPB: ${s.lecturer(item.reviewerLecturerId ?? "")}`,
      `Điểm phản biện lưu tham chiếu: ${item.reviewerScore ?? "Không có"}`,
      `Nhận xét GVPB: ${item.reviewerComment ?? "Không có"}`,
      `Trạng thái: ${stages[item.stage ?? ""] ?? item.status}`,
      `Quyết định: ${item.decision || "Chờ xét"}`,
      `Đợt tiếp tục: ${db.terms.find((t) => t.id === item.carryOverTermId)?.name ?? "Chưa xác định"}`,
      "Sinh viên                 GVPB                 Bộ môn / Khoa",
      "(Ký và ghi rõ họ tên)",
    ]);
  const open = (item: Deferment) => {
    setSelected(item);
    setDecision("");
    setTarget(
      item.carryOverTermId ??
        db.terms.find((t) => t.id !== s.term.id && !t.locked)?.id ??
        "",
    );
  };
  const done = (fn: () => unknown) =>
    s.exec(() => {
      fn();
      setSelected(undefined);
    });
  return (
    <>
      <PageHeader
        title="Bảo lưu và tiếp tục đồ án"
        description="Theo dõi đề nghị, ý kiến phản biện, đơn bảo lưu, quyết định và hồ sơ tiếp tục ở đợt sau."
        actions={
          canCreate && (
            <Button
              onClick={() => {
                setStudent(s.user.studentId ?? s.term.studentIds[0] ?? "");
                setReason("");
                setMode("STANDARD");
                setCreate(true);
              }}
            >
              <Save size={16} aria-hidden="true" />
              Tạo đề nghị bảo lưu
            </Button>
          )
        }
      />
      <Notice tone="warning">
        Nhánh sau phản biện: GVPB xác nhận → sinh viên nộp đơn → Khoa duyệt →
        tiếp tục ở đợt mới. Điểm cũ được lưu tham chiếu; không tự chuyển điểm
        vào kết quả đợt sau. Hồ sơ khi quay lại phải kiểm tra và duyệt lại.
      </Notice>
      <Card title="Lịch sử bảo lưu">
        <DataTable
          rows={rows}
          searchText={(d) => `${s.name(d.studentId)} ${d.reason}`}
          columns={[
            {
              key: "student",
              title: "Sinh viên",
              render: (d) => s.name(d.studentId),
            },
            {
              key: "reason",
              title: "Lý do / Hình thức",
              render: (d) => (
                <div>
                  {d.reason}
                  <small className="block muted">
                    {d.mode === "AFTER_REVIEW"
                      ? "Sau phản biện"
                      : "Thông thường"}
                  </small>
                </div>
              ),
            },
            {
              key: "status",
              title: "Quy trình",
              render: (d) => (
                <div>
                  <Badge value={d.status} />
                  <small className="block muted mt-1">
                    {stages[d.stage ?? ""] ?? "Chờ Khoa xét"}
                  </small>
                </div>
              ),
            },
            {
              key: "decision",
              title: "Quyết định / Liên kết",
              render: (d) => (
                <div>
                  {d.decision || "Chưa có quyết định"}
                  {d.carryOverTermId && (
                    <small className="block muted">
                      Tiếp tục:{" "}
                      {db.terms.find((t) => t.id === d.carryOverTermId)?.name}
                    </small>
                  )}
                </div>
              ),
            },
            {
              key: "action",
              title: "",
              render: (d) => (
                <Button variant="secondary" onClick={() => open(d)}>
                  <Eye size={16} aria-hidden="true" />
                  Hồ sơ / Xử lý
                </Button>
              ),
            },
          ]}
        />
      </Card>
      {create && (
        <Modal title="Đề nghị bảo lưu" onClose={() => setCreate(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              s.exec(() => {
                requestDeferment(s.term.id, student, reason, mode);
                setCreate(false);
              });
            }}
          >
            <Field label="Sinh viên">
              <select
                value={student}
                disabled={!s.faculty}
                onChange={(e) => setStudent(e.target.value)}
                required
              >
                {s.term.studentIds.filter(s.visible).map((id) => (
                  <option key={id} value={id}>
                    {s.name(id)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hình thức">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                <option value="STANDARD">
                  Thông thường · gửi Khoa xem xét
                </option>
                <option value="AFTER_REVIEW">
                  Đã phản biện, chưa bảo vệ · xin ý kiến GVPB
                </option>
              </select>
            </Field>
            <Field
              label="Lý do và nguyện vọng"
              hint="Nêu hoàn cảnh, thời gian dự kiến tiếp tục và thông tin liên hệ."
            >
              <textarea
                required
                minLength={10}
                rows={5}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <div className="dialog-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setCreate(false)}
              >
                <X size={16} aria-hidden="true" />
                Hủy
              </Button>
              <Button disabled={s.pending}>
                <Send size={16} aria-hidden="true" />
                Gửi đề nghị
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal
          title={`Bảo lưu · ${s.name(selected.studentId)}`}
          onClose={() => setSelected(undefined)}
          wide
        >
          <div className="space-y-3 mb-5">
            <p>{selected.reason}</p>
            <Badge value={selected.status} />
            <p>{stages[selected.stage ?? ""] ?? "Chờ Khoa xét"}</p>
            {selected.mode === "AFTER_REVIEW" && (
              <Notice>
                GVPB: {s.lecturer(selected.reviewerLecturerId ?? "")} · Điểm lưu
                tham chiếu: {selected.reviewerScore ?? "—"} / 10.
                <p>{selected.reviewerComment}</p>
              </Notice>
            )}
            {selected.decision && (
              <Notice
                tone={selected.status === "REJECTED" ? "danger" : "success"}
              >
                {selected.decision}
              </Notice>
            )}
          </div>
          {selected.stage === "CHO_GVPB" &&
            selected.reviewerLecturerId === s.user.lecturerId && (
              <>
                <Field label="Nhận xét của GVPB">
                  <textarea
                    rows={4}
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                  />
                </Field>
                <div className="dialog-actions">
                  <Button
                    variant="danger"
                    onClick={() =>
                      done(() =>
                        confirmDefermentReview(selected.id, false, decision),
                      )
                    }
                  >
                    <X size={16} aria-hidden="true" />
                    Không đồng ý
                  </Button>
                  <Button
                    onClick={() =>
                      done(() =>
                        confirmDefermentReview(selected.id, true, decision),
                      )
                    }
                  >
                    <Save size={16} aria-hidden="true" />
                    Đồng ý bảo lưu
                  </Button>
                </div>
              </>
            )}
          {selected.stage === "GVPB_DONG_Y" &&
            (s.faculty || s.user.studentId === selected.studentId) && (
              <Button
                onClick={() =>
                  done(() => submitDefermentApplication(selected.id))
                }
              >
                <Send size={16} aria-hidden="true" />
                Nộp đơn đến Khoa
              </Button>
            )}
          {selected.status === "PENDING" &&
            (selected.mode !== "AFTER_REVIEW" ||
              selected.stage === "DA_NOP_DON") &&
            s.faculty && (
              <>
                <Field label="Nội dung quyết định Khoa / Bộ môn">
                  <textarea
                    value={decision}
                    rows={4}
                    onChange={(e) => setDecision(e.target.value)}
                    placeholder="Căn cứ, kết luận và hướng xử lý hồ sơ..."
                  />
                </Field>
                <div className="dialog-actions">
                  <Button
                    variant="danger"
                    disabled={s.pending}
                    onClick={() =>
                      done(() =>
                        decideDeferment(selected.id, "REJECTED", decision),
                      )
                    }
                  >
                    <X size={16} aria-hidden="true" />
                    Từ chối
                  </Button>
                  <Button
                    disabled={s.pending}
                    onClick={() =>
                      done(() =>
                        decideDeferment(selected.id, "APPROVED", decision),
                      )
                    }
                  >
                    <Save size={16} aria-hidden="true" />
                    Duyệt bảo lưu
                  </Button>
                </div>
              </>
            )}
          {selected.status === "APPROVED" &&
            selected.stage !== "DA_TIEP_TUC" &&
            s.faculty && (
              <div className="mt-5">
                <Field
                  label="Đợt tiếp tục"
                  hint="Xác minh học vụ mới, GVHD tham gia và quota. Tạo hồ sơ nháp mới, giữ nguyên hồ sơ cũ."
                >
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  >
                    <option value="">Chọn đợt</option>
                    {db.terms
                      .filter(
                        (t) =>
                          t.id !== selected.termId &&
                          !t.locked &&
                          !t.resultsPublished,
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Button
                  disabled={!target || s.pending}
                  onClick={() =>
                    done(() => resumeDeferment(selected.id, target))
                  }
                >
                  <Plus size={16} aria-hidden="true" />
                  Tạo hồ sơ tiếp tục
                </Button>
              </div>
            )}
          {selected.carryOverTermId && (
            <Notice tone="success">
              Hồ sơ được liên kết đến{" "}
              {db.terms.find((t) => t.id === selected.carryOverTermId)?.name}.
              Đề cương mới ở trạng thái nháp; chưa chuyển điểm cũ.
            </Notice>
          )}
          <div className="dialog-actions">
            <Button
              variant="secondary"
              onClick={() => s.exec(() => pdf(selected))}
            >
              <Download size={16} aria-hidden="true" />
              Tải đơn PDF
            </Button>
            <Button variant="ghost" onClick={() => setSelected(undefined)}>
              <X size={16} aria-hidden="true" />
              Đóng
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export default function DefermentPage() {
  return <DataBoundary>{(db) => <Content db={db} />}</DataBoundary>;
}
