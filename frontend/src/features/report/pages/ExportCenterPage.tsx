import { useState } from "react";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  DataBoundary,
  DataTable,
  Empty,
  Field,
  Modal,
  Notice,
  PageHeader,
  date,
} from "../../../shared/components/kit";
import type { DemoDb, ExportJob } from "../../../shared/data/types";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import {
  allowedReportKinds,
  buildReport,
  createReport,
  reportNames,
  type ReportFilters,
  type ReportKind,
} from "../services/report-service";
const statusOptions: Record<ReportKind, [string, string][]> = {
  STUDENTS: [
    ["ELIGIBLE", "Đủ điều kiện"],
    ["INELIGIBLE", "Chưa đủ điều kiện"],
  ],
  ROSTER: [
    ["ELIGIBLE", "Đủ điều kiện"],
    ["INELIGIBLE", "Chưa đủ điều kiện"],
  ],
  LECTURERS: [
    ["AVAILABLE", "Còn quota"],
    ["FULL", "Đủ/vượt quota"],
  ],
  REGISTRATIONS: [
    ["DRAFT", "Bản nháp"],
    ["SUBMITTED", "Đã nộp"],
  ],
  ASSIGNMENTS: [
    ["DRAFT", "Phương án nháp"],
    ["PUBLISHED", "Đã công bố"],
    ["UNASSIGNED", "Chưa phân công"],
  ],
  TOPICS: [
    ["DRAFT", "Bản nháp"],
    ["SUBMITTED", "Đã nộp"],
    ["REVISION", "Cần chỉnh sửa"],
    ["APPROVED", "Đã duyệt"],
    ["LOCKED", "Đã chốt"],
  ],
  PROPOSAL: [
    ["DRAFT", "Bản nháp"],
    ["SUBMITTED", "Đã nộp"],
    ["REVISION", "Cần chỉnh sửa"],
    ["APPROVED", "Đã duyệt"],
    ["LOCKED", "Đã chốt"],
  ],
};
function Content({ db }: { db: DemoDb }) {
  const { user, termId, term } = useWorkspace();
  const action = useAction();
  const cache = useQueryClient();
  const kinds = allowedReportKinds(user);
  const [kind, setKind] = useState<ReportKind>(kinds[0] ?? "ASSIGNMENTS");
  const [format, setFormat] = useState<ExportJob["format"]>("PDF");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [preview, setPreview] = useState(false),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const manager = user.roles.some((r) => r === "ADMIN" || r === "FACULTY");
  const visibleAssignments = db.assignments.filter(
    (a) =>
      a.termId === termId &&
      (manager ||
        (term.assignmentPublished &&
          a.published &&
          (a.lecturerId === user.lecturerId ||
            a.studentId === user.studentId))),
  );
  const visibleStudents = db.students.filter(
    (s) =>
      term.studentIds.includes(s.id) &&
      (manager || visibleAssignments.some((a) => a.studentId === s.id)),
  );
  const lecturerIds = manager
    ? term.lecturers.map((l) => l.lecturerId)
    : user.lecturerId
      ? [user.lecturerId]
      : visibleAssignments.map((a) => a.lecturerId);
  const lecturers = db.lecturers.filter((l) => lecturerIds.includes(l.id));
  let report: ReturnType<typeof buildReport> | undefined;
  let reportError = "";
  try {
    report = buildReport(db, user, termId, kind, filters);
  } catch (e) {
    reportError = e instanceof Error ? e.message : "Không thể đọc biểu mẫu";
  }
  const reportColumns = [
    ...new Set(report?.rows.flatMap((row) => Object.keys(row)) ?? []),
  ];
  const execute = (
    selectedKind = kind,
    selectedFormat = format,
    selectedFilters = filters,
  ) => {
    setError("");
    setWorking(true);
    void action
      .run(async () => {
        try {
          const task = createReport(
            termId,
            selectedKind,
            selectedFormat,
            selectedFilters,
          );
          void cache.invalidateQueries({ queryKey: ["demo"] });
          await task;
        } catch (e) {
          setError(e instanceof Error ? e.message : "Không thể xuất tệp");
          throw e;
        } finally {
          setWorking(false);
        }
      })
      .catch(() => {});
  };
  const jobs = db.exports.filter(
    (job) =>
      job.termId === termId &&
      job.reportKind &&
      kinds.includes(job.reportKind as ReportKind) &&
      (manager || job.requestedBy === user.id),
  );
  if (!kinds.length)
    return (
      <>
        <PageHeader title="Xuất dữ liệu Bước 1–3" />
        <Card>
          <Empty
            title="Chưa có biểu mẫu dành cho vai trò này"
            description="Biểu mẫu của Hội đồng thuộc giai đoạn sau và nằm ngoài phạm vi hiện tại."
          />
        </Card>
      </>
    );
  return (
    <>
      <PageHeader
        title="Xuất dữ liệu và biểu mẫu"
        description="Danh sách, đăng ký, phân công, đề tài và đề cương trong Bước 1–3. Chọn đợt trên thanh điều hướng trước khi xuất."
      />
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card title="Thiết lập xuất tệp" description={term.name}>
          <Field label="Nội dung">
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as ReportKind);
                setFilters({ ...filters, status: "", studentId: "" });
                setError("");
              }}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {reportNames[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hệ đào tạo">
            <select
              value={filters.program ?? ""}
              onChange={(e) =>
                setFilters({ ...filters, program: e.target.value })
              }
            >
              <option value="">Tất cả hệ trong đợt</option>
              {db.catalogs
                .filter((c) => c.kind === "program")
                .map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Hướng đồ án">
            <select
              value={filters.directionId ?? ""}
              onChange={(e) =>
                setFilters({ ...filters, directionId: e.target.value })
              }
            >
              <option value="">Tất cả hướng</option>
              {db.catalogs
                .filter((c) => c.kind === "direction")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Giảng viên hướng dẫn">
            <select
              value={filters.lecturerId ?? ""}
              onChange={(e) =>
                setFilters({ ...filters, lecturerId: e.target.value })
              }
            >
              <option value="">Tất cả trong phạm vi quyền</option>
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trạng thái">
            <select
              value={filters.status ?? ""}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="">Tất cả trạng thái</option>
              {statusOptions[kind].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          {kind === "PROPOSAL" && (
            <>
              <Field label="Sinh viên">
                <select
                  value={filters.studentId ?? ""}
                  onChange={(e) =>
                    setFilters({ ...filters, studentId: e.target.value })
                  }
                >
                  <option value="">Tất cả hồ sơ trong phạm vi quyền</option>
                  {visibleStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Biểu mẫu bằng cấp"
                hint="Loại bằng được chọn riêng, không suy ra từ hệ đào tạo."
              >
                <select
                  value={filters.degree ?? "Cử nhân"}
                  onChange={(e) =>
                    setFilters({ ...filters, degree: e.target.value })
                  }
                >
                  <option>Cử nhân</option>
                  <option>Kỹ sư</option>
                </select>
              </Field>
            </>
          )}
          <Field label="Định dạng">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportJob["format"])}
            >
              <option value="PDF">
                {kind === "PROPOSAL"
                  ? "PDF · Biểu mẫu đề cương"
                  : "PDF · Bảng in"}
              </option>
              <option value="XLSX">Excel · Bảng dữ liệu</option>
            </select>
          </Field>
          <div className="flex flex-wrap gap-3 mt-5">
            <Button
              variant="secondary"
              disabled={!report?.rows.length || !!reportError}
              onClick={() => setPreview(true)}
            >
              Xem trước
            </Button>
            <Button
              disabled={working || !report?.rows.length || !!reportError}
              onClick={() => execute()}
            >
              {working ? (
                <Loader2 className="animate-spin" size={17} />
              ) : format === "PDF" ? (
                <FileDown size={17} />
              ) : (
                <FileSpreadsheet size={17} />
              )}{" "}
              {working ? "Đang tạo tệp…" : "Tạo và tải tệp"}
            </Button>
          </div>
        </Card>
        <div className="space-y-5">
          <Card title="Phạm vi dữ liệu">
            <p className="text-4xl font-bold mb-3">
              {report?.rows.length ?? 0}{" "}
              <span className="text-base text-slate-500 font-normal">
                bản ghi phù hợp
              </span>
            </p>
            <p className="font-medium">{reportNames[kind]}</p>
            <p className="muted mt-2">
              {term.code} · {term.program}. Quản trị/Giáo vụ xem toàn bộ đợt; GV
              chỉ xuất hồ sơ được giao chính thức; SV chỉ xuất phân công đã công
              bố và đề cương của mình.
            </p>
            {!reportError && !report?.rows.length && (
              <Notice tone="warning">
                Không có dữ liệu phù hợp. Thử thay bộ lọc hoặc chọn một đợt
                khác.
              </Notice>
            )}
            {reportError && <Notice tone="warning">{reportError}</Notice>}
            {error && <Notice tone="danger">{error}</Notice>}
            {working && (
              <Notice>
                Đang tạo tệp từ dữ liệu đã kiểm tra quyền. Khi hoàn tất, trình
                duyệt sẽ tải tệp xuống.
              </Notice>
            )}
          </Card>
          <Card title="Lịch sử công việc xuất">
            <DataTable
              rows={jobs}
              columns={[
                { key: "name", title: "Nội dung", render: (job) => job.name },
                {
                  key: "format",
                  title: "Định dạng",
                  render: (job) => job.format,
                },
                {
                  key: "at",
                  title: "Thời gian",
                  render: (job) => (
                    <div>
                      {date(job.at)}
                      <small className="block muted">
                        {new Date(job.at).toLocaleTimeString("vi-VN", {
                          timeZone: "Asia/Ho_Chi_Minh",
                        })}
                      </small>
                    </div>
                  ),
                },
                {
                  key: "status",
                  title: "Trạng thái",
                  render: (job) => <Badge value={job.status} />,
                },
                {
                  key: "info",
                  title: "Thông tin",
                  render: (job) =>
                    job.error ||
                    (job.status === "COMPLETED"
                      ? "Đã tạo và gửi tới trình duyệt"
                      : "Đang xử lý"),
                },
                {
                  key: "retry",
                  title: "",
                  render: (job) =>
                    job.status === "FAILED" && (
                      <Button
                        variant="secondary"
                        disabled={working}
                        onClick={() =>
                          execute(
                            job.reportKind as ReportKind,
                            job.format,
                            job.filters ?? {},
                          )
                        }
                      >
                        Thử lại
                      </Button>
                    ),
                },
              ]}
            />
          </Card>
        </div>
      </div>
      {preview && report && (
        <Modal
          title={`Xem trước · ${report.title}`}
          onClose={() => setPreview(false)}
          wide
        >
          <Notice>
            {kind === "PROPOSAL"
              ? "Bảng dưới đây là thông tin các hồ sơ đang chọn. PDF đề cương được trình bày theo biểu mẫu của từng hồ sơ."
              : "Bảng dưới đây phản ánh dữ liệu và bộ lọc hiện tại. Mỗi dòng là một bản ghi; tiêu đề cột được giữ khi xuất PDF hoặc Excel."}
          </Notice>
          <div className="table-scroll mt-4 max-h-[60vh] overflow-auto">
            <table>
              <thead>
                <tr>
                  {reportColumns.map((key) => (
                    <th
                      key={key}
                      scope="col"
                      className="sticky top-0 z-10 bg-slate-100 whitespace-nowrap"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (
                  <tr key={index}>
                    {reportColumns.map((key) => (
                      <td
                        key={key}
                        className="min-w-[120px] max-w-[320px] whitespace-pre-wrap break-words"
                      >
                        {row[key] === null ||
                        row[key] === undefined ||
                        row[key] === ""
                          ? "—"
                          : String(row[key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => setPreview(false)}>
              Đóng
            </Button>
            <Button disabled={working} onClick={() => execute()}>
              Tải {format}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export default function ExportCenterPage() {
  return <DataBoundary>{(db) => <Content db={db} />}</DataBoundary>;
}
