import { useId, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  FolderOpen,
  Info,
  Upload,
  X,
} from "lucide-react";
import { Button, Card, Field, Notice } from "../../../shared/components/kit";
import type { Term } from "../../../shared/data/types";
import "./import-page.css";

type ImportKind = "student" | "lecturer";

export function ImportSteps({ stage }: { stage: 1 | 2 | 3 }) {
  return (
    <ol className="import-steps" aria-label="Tiến trình nhập dữ liệu">
      {[
        ["Chuẩn bị tệp", "Chọn danh sách và tải lên"],
        ["Kiểm tra dữ liệu", "Xem kết quả từng dòng"],
        ["Xác nhận nhập", "Lưu các dòng hợp lệ"],
      ].map(([title, description], index) => (
        <li
          key={title}
          className={
            stage === index + 1 ? "active" : stage > index + 1 ? "complete" : ""
          }
          aria-current={stage === index + 1 ? "step" : undefined}
        >
          <span className="import-step-number">
            {stage > index + 1 ? (
              <Check size={17} aria-hidden="true" />
            ) : (
              `0${index + 1}`
            )}
          </span>
          <span>
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

function FilePicker({
  file,
  onChange,
  disabled,
  maxSizeMb,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled: boolean;
  maxSizeMb: number;
}) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  function select(files: File[]) {
    if (disabled || !files.length) return;
    const next = files[0];
    const message =
      files.length > 1
        ? "Vui lòng chọn một tệp mỗi lần."
        : !/\.(csv|xlsx)$/i.test(next.name)
          ? "Chỉ nhận tệp CSV hoặc Excel .xlsx."
          : next.size > maxSizeMb * 1024 * 1024
            ? `Tệp được chọn vượt quá ${maxSizeMb} MB.`
            : "";
    setError(message);
    onChange(message ? null : next);
  }
  return (
    <div className="import-file-picker">
      <div
        className={`import-dropzone ${dragging ? "dragging" : ""} ${disabled ? "disabled" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          select(Array.from(event.dataTransfer.files));
        }}
      >
        <label htmlFor={id}>
          <input
            id={id}
            className="import-file-input"
            type="file"
            accept=".csv,.xlsx"
            aria-label="Chọn tệp CSV hoặc XLSX"
            aria-describedby={`${id}-hint`}
            disabled={disabled}
            onChange={(event) => {
              select(Array.from(event.target.files || []));
              event.target.value = "";
            }}
          />
          <span className="import-upload-icon">
            <Upload size={27} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <strong>
            {dragging
              ? "Thả tệp để tải lên"
              : file
                ? "Chọn tệp khác để thay thế"
                : "Kéo thả tệp vào đây"}
          </strong>
          <span className="import-dropzone-caption">
            hoặc <span>chọn tệp từ máy tính</span>
          </span>
          <small id={`${id}-hint`}>
            CSV hoặc Excel (.xlsx) · Tối đa {maxSizeMb} MB
          </small>
        </label>
      </div>
      {file && (
        <div className="import-selected-file" role="status">
          <span className="import-file-icon">
            <FileSpreadsheet size={22} aria-hidden="true" />
          </span>
          <div>
            <strong title={file.name}>{file.name}</strong>
            <small>
              {file.size < 1024 * 1024
                ? `${(file.size / 1024).toFixed(1)} KB`
                : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}{" "}
              · Đã chọn tệp
            </small>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Bỏ tệp đã chọn"
            disabled={disabled}
            onClick={() => {
              setError("");
              onChange(null);
            }} title="Bỏ tệp đã chọn"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}

export function ImportSourceCard({
  kind,
  onKindChange,
  term,
  file,
  onFileChange,
  onTemplate,
  disabled = false,
  requireTerm = false,
  maxSizeMb = 5,
  children,
}: {
  kind: ImportKind;
  onKindChange: (kind: ImportKind) => void;
  term: Term;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onTemplate: (format: "csv" | "xlsx") => void;
  disabled?: boolean;
  requireTerm?: boolean;
  maxSizeMb?: number;
  children?: ReactNode;
}) {
  return (
    <Card
      title="Chọn nguồn dữ liệu"
      description="Bắt đầu từ tệp mẫu để có đúng cấu trúc danh sách."
      className="import-source-card"
    >
      <div className="import-source-fields">
        <Field label="Loại danh sách">
          <select
            aria-label="Loại danh sách"
            value={kind}
            disabled={disabled}
            onChange={(event) => onKindChange(event.target.value as ImportKind)}
          >
            <option value="student">Sinh viên</option>
            <option value="lecturer">Giảng viên</option>
          </select>
        </Field>
        <Field label="Đợt đang chọn">
          <div className="import-term">
            <FolderOpen size={18} aria-hidden="true" />
            <span>
              <strong>{term.code || "Chưa chọn đợt"}</strong>
              {term.code && <small>{term.program}</small>}
            </span>
          </div>
        </Field>
      </div>
      <div className="import-template-bar">
        <div className="import-template-label">
          <span>
            <FileSpreadsheet size={21} aria-hidden="true" />
          </span>
          <div>
            <strong>Tệp mẫu chuẩn</strong>
            <small>Tải mẫu và điền danh sách của bạn</small>
          </div>
        </div>
        <div className="import-template-actions">
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => onTemplate("csv")}
          >
            <ArrowDownToLine size={15} aria-hidden="true" />
            Tải mẫu CSV
          </Button>
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => onTemplate("xlsx")}
          >
            <ArrowDownToLine size={15} aria-hidden="true" />
            Tải mẫu Excel
          </Button>
        </div>
      </div>
      <FilePicker
        key={kind}
        file={file}
        onChange={onFileChange}
        disabled={disabled || (requireTerm && !term.id)}
        maxSizeMb={maxSizeMb}
      />
      {children}
    </Card>
  );
}

export function ImportRules({
  kind,
  contactsOptional = false,
}: {
  kind: ImportKind;
  contactsOptional?: boolean;
}) {
  const student = kind === "student";
  const rules = [
    {
      title: "Dùng đúng tệp mẫu",
      description: `Giữ nguyên tên cột và định dạng mã ${student ? "sinh viên" : "giảng viên"} dưới dạng văn bản.`,
    },
    {
      title: "Tự động cấp tài khoản",
      description: `Mã ${student ? "sinh viên" : "giảng viên"} mới được dùng làm tên đăng nhập và mật khẩu ban đầu. Người dùng đổi mật khẩu khi đăng nhập lần đầu.`,
    },
    student
      ? {
          title: "Đáp ứng điều kiện của đợt",
          description:
            "Đúng hệ đào tạo, GPA từ 0 đến 4 và đạt điều kiện học vụ của đợt được chọn.",
        }
      : {
          title: "Thông tin hướng dẫn hợp lệ",
          description:
            "Điền đúng mã bộ môn và hướng chuyên môn hiện có. Chỉ tiêu hướng dẫn là số nguyên từ 0 đến 100.",
        },
  ];
  return (
    <aside className="import-guide">
      <div className="import-guide-heading">
        <span>
          <CheckCircle2 size={22} aria-hidden="true" />
        </span>
        <div>
          <h2>Trước khi tải lên</h2>
          <p>Chuẩn bị đúng, nhập nhanh hơn</p>
        </div>
      </div>
      <ul>
        {rules.map((rule) => (
          <li key={rule.title}>
            <Check size={17} aria-hidden="true" />
            <div>
              <strong>{rule.title}</strong>
              <p>{rule.description}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="import-guide-tip">
        <Info size={18} aria-hidden="true" />
        <p>
          {contactsOptional
            ? "Email và số điện thoại có thể để trống. Người dùng có thể bổ sung khi đăng nhập."
            : "Không lặp mã giữa các dòng. Kiểm tra lại thông tin liên hệ trước khi tải lên."}
        </p>
      </div>
      <div className="import-guide-footer">
        <strong>Bạn luôn được kiểm tra trước</strong>
        <p>
          Xem các dòng hợp lệ và dòng lỗi, sau đó xác nhận nhập. Tài khoản và
          mật khẩu hiện có được giữ nguyên.
        </p>
      </div>
    </aside>
  );
}
