import { FilterX, Eye } from "lucide-react";
import { useState } from "react";
import type { Audit } from "../../../shared/data/types";
import {
  Button,
  Card,
  DataTable,
  Field,
  Modal,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
const time = (at: string) =>
  new Date(at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
export default function AuditLogPage() {
  const { db } = useWorkspace();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [detail, setDetail] = useState<Audit | null>(null);
  const rows = db.audits.filter(
    (r) =>
      (!from || r.at >= from) &&
      (!to || r.at <= `${to}T23:59:59+07:00`) &&
      (!actor || r.actor === actor) &&
      (!action || r.action === action),
  );
  return (
    <>
      <PageHeader
        title="Nhật ký hoạt động"
        description="Tra cứu thao tác vận hành. Thời gian hiển thị theo Việt Nam."
      />
      <Card title="Bộ lọc tra cứu">
        <div className="form-grid">
          <Field label="Từ ngày">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="Đến ngày">
            <input
              type="date"
              min={from}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Field label="Người thao tác">
            <select value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="">Tất cả người dùng</option>
              {[...new Set(db.audits.map((r) => r.actor))].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Loại thao tác">
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">Tất cả thao tác</option>
              {[...new Set(db.audits.map((r) => r.action))].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setFrom("");
              setTo("");
              setActor("");
              setAction("");
            }}
          >
            <FilterX size={16} aria-hidden="true" />
            Xóa bộ lọc
          </Button>
        </div>
      </Card>
      <div className="mt-6">
        <Card title="Lịch sử hệ thống">
          <DataTable
            rows={rows}
            searchText={(r) => `${r.actor} ${r.action} ${r.detail}`}
            columns={[
              { key: "at", title: "Thời điểm", render: (r) => time(r.at) },
              {
                key: "actor",
                title: "Người thao tác",
                render: (r) => <strong>{r.actor}</strong>,
              },
              { key: "action", title: "Hành động", render: (r) => r.action },
              {
                key: "detail",
                title: "Nội dung",
                render: (r) => <p className="text-wrap">{r.detail}</p>,
              },
              {
                key: "open",
                title: "Chi tiết",
                render: (r) => (
                  <Button variant="ghost" onClick={() => setDetail(r)}>
                    <Eye size={16} aria-hidden="true" />
                    Xem bản ghi
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      </div>
      {detail && (
        <Modal title="Chi tiết nhật ký" onClose={() => setDetail(null)}>
          <dl className="info-grid">
            <div>
              <dt>Mã bản ghi</dt>
              <dd>{detail.id}</dd>
            </div>
            <div>
              <dt>Thời điểm</dt>
              <dd>{time(detail.at)}</dd>
            </div>
            <div>
              <dt>Người thao tác</dt>
              <dd>{detail.actor}</dd>
            </div>
            <div>
              <dt>Hành động</dt>
              <dd>{detail.action}</dd>
            </div>
          </dl>
          <p className="mt-5 whitespace-pre-wrap text-sm">{detail.detail}</p>
          <div className="mt-5">
            <Notice>
              Nhật ký chỉ được ghi thêm. Giao diện không cung cấp sửa hoặc xóa
              bản ghi.
            </Notice>
          </div>
        </Modal>
      )}
    </>
  );
}
