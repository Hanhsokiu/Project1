import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  CheckCheck,
  RotateCcw,
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSearch,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useDemo } from "../hooks/use-demo";
import type { DemoDb, StoredFile } from "../data/types";
export const labels: Record<string, string> = {
  DRAFT: "Bản nháp",
  OPEN_REGISTRATION: "Mở đăng ký",
  CLOSED_REGISTRATION: "Đóng đăng ký",
  IN_PROGRESS: "Đang thực hiện",
  DEFENDING: "Đang bảo vệ",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  SUBMITTED: "Đã nộp",
  REVISION: "Cần chỉnh sửa",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  LOCKED: "Đã chốt",
  PASS: "Đạt",
  FAIL: "Không đạt",
  PENDING: "Đang chờ",
  SENT: "Đã gửi",
  PROCESSING: "Đang gửi",
  UNREAD: "Chưa đọc",
  READ: "Đã đọc",
  UNDER_REVIEW: "Đang duyệt",
  FAILED: "Thất bại",
  ADMIN: "Quản trị viên",
  FACULTY: "Giáo vụ Khoa",
  LECTURER: "Giảng viên",
  STUDENT: "Sinh viên",
  COMMITTEE: "Thành viên Hội đồng",
  ADVISOR: "Hướng dẫn",
  REVIEWER: "Phản biện",
  CHAIR: "Chủ tịch",
  SECRETARY: "Thư ký",
  MEMBER: "Ủy viên",
};
export function Badge({
  value,
  children,
}: {
  value?: string;
  children?: ReactNode;
}) {
  return (
    <span className={`badge badge-${value || "neutral"}`}>
      {children || labels[value || ""] || value}
    </span>
  );
}
export function PageHeader({
  eyebrow = "QUẢN LÝ ĐỒ ÁN",
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="muted mt-2">{description}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
export function Card({
  title,
  description,
  children,
  action,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-heading">
          <div>
            <h2>{title}</h2>
            {description && <p className="muted text-sm mt-1">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
      {error && <small className="text-red-600">{error}</small>}
    </label>
  );
}
export function Empty({
  title = "Chưa có dữ liệu",
  description = "Dữ liệu sẽ xuất hiện khi có hồ sơ phù hợp với bộ lọc.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <FileSearch size={34} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "success" | "danger";
}) {
  return (
    <div
      className={`notice notice-${tone}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <AlertCircle size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,a[href]",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    ref.current
      ?.querySelector<HTMLElement>("input,select,textarea,button")
      ?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" aria-label="Đóng" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
export function Confirm({
  title,
  description,
  onConfirm,
  onClose,
  pending = false,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{description}</p>
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onClose}>
          <X size={16} aria-hidden="true" />
          Hủy
        </Button>
        <Button disabled={pending} onClick={onConfirm}>
          <CheckCheck size={16} aria-hidden="true" />
          {pending ? "Đang xử lý…" : "Xác nhận"}
        </Button>
      </div>
    </Modal>
  );
}
export function DataBoundary({
  children,
}: {
  children: (db: DemoDb) => ReactNode;
}) {
  const q = useDemo();
  if (q.isPending)
    return (
      <div className="loading">
        <Loader2 className="animate-spin" /> Đang tải dữ liệu…
      </div>
    );
  if (q.isError)
    return (
      <Card>
        <Notice tone="danger">{q.error.message}</Notice>
        <Button className="mt-4" onClick={() => q.refetch()}>
          <RotateCcw size={16} aria-hidden="true" />
          Thử lại
        </Button>
      </Card>
    );
  return <>{children(q.data)}</>;
}
export function DataTable<T>({
  rows,
  columns,
  searchText,
  filters,
  emptyTitle,
  pageSize = 8,
}: {
  rows: T[];
  columns: { key: string; title: string; render: (row: T) => ReactNode }[];
  searchText?: (row: T) => string;
  filters?: ReactNode;
  emptyTitle?: string;
  pageSize?: number;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filtered = searchText
    ? rows.filter((r) =>
        searchText(r)
          .toLocaleLowerCase("vi")
          .includes(search.toLocaleLowerCase("vi")),
      )
    : rows;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const actual = Math.min(page, pages);
  return (
    <div>
      {(searchText || filters) && (
        <div className="table-toolbar">
          {searchText && (
            <div className="search-input">
              <Search size={17} />
              <input
                aria-label="Tìm kiếm"
                placeholder="Tìm kiếm mã, tên…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          )}
          {filters}
          <span className="muted text-sm ml-auto">
            {filtered.length} bản ghi
          </span>
        </div>
      )}
      {!filtered.length ? (
        <Empty title={emptyTitle} />
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key}>{c.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice((actual - 1) * pageSize, actual * pageSize)
                  .map((r, i) => (
                    <tr key={(r as { id?: string }).id || i}>
                      {columns.map((c) => (
                        <td key={c.key}>{c.render(r)}</td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>
              Hiển thị {(actual - 1) * pageSize + 1}–
              {Math.min(actual * pageSize, filtered.length)} / {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="icon-btn"
                aria-label="Trang trước"
                disabled={actual === 1}
                onClick={() => setPage(actual - 1)}
              >
                <ChevronLeft size={17} />
              </button>
              <span>
                Trang {actual} / {pages}
              </span>
              <button
                className="icon-btn"
                aria-label="Trang sau"
                disabled={actual === pages}
                onClick={() => setPage(actual + 1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
export function Person({ name, sub }: { name: string; sub?: string }) {
  return (
    <div className="person">
      <span className="avatar">
        {name
          .split(" ")
          .slice(-2)
          .map((x) => x[0])
          .join("")}
      </span>
      <div>
        <strong>{name}</strong>
        {sub && <small>{sub}</small>}
      </div>
    </div>
  );
}
export function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="flex justify-between items-center">
        <span className="muted text-sm">{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
export function Back({ to = "/" }: { to?: string }) {
  return (
    <Link className="back-link" to={to}>
      <ArrowLeft size={16} /> Quay lại
    </Link>
  );
}
export function downloadFile(file: StoredFile) {
  if (file.dataUrl) {
    const a = document.createElement("a");
    a.href = file.dataUrl;
    a.download = file.name;
    a.click();
  } else if (file.url) {
    window.open(file.url, "_blank", "noopener,noreferrer");
  }
}
export function FileLink({ file }: { file: StoredFile }) {
  return (
    <button className="file-link" onClick={() => downloadFile(file)}>
      <Download size={16} />
      {file.name}
      <small>
        {file.size ? `${(file.size / 1024).toFixed(1)} KB` : "Liên kết"}
      </small>
    </button>
  );
}
export function readFile(file: File): Promise<StoredFile> {
  if (file.size > 4 * 1024 * 1024)
    return Promise.reject(
      new Error(
        "Tệp demo tối đa 4 MB. Có thể dùng liên kết repository cho mã nguồn.",
      ),
    );
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không đọc được tệp"));
    reader.onload = () =>
      resolve({
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: String(reader.result),
      });
    reader.readAsDataURL(file);
  });
}
export const date = (value: string) =>
  value
    ? new Date(
        value.length === 10 ? `${value}T12:00:00+07:00` : value,
      ).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    : "—";
export function Progress({ value }: { value: number }) {
  return (
    <div className="flex gap-3 items-center">
      <div className="progress-track">
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <small>{value}%</small>
    </div>
  );
}
