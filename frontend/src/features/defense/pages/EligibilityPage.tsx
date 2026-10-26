import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  DataBoundary,
  DataTable,
  Modal,
  Notice,
  PageHeader,
  Person,
  Stat,
} from "../../../shared/components/kit";
import type { DemoDb } from "../../../shared/data/types";
import { useDefenseScope } from "../components/DefenseScope";
import { eligibilityFor } from "../services/defense-service";
function Content({ db }: { db: DemoDb }) {
  const s = useDefenseScope(db);
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState("");
  const all = (s.term?.studentIds ?? [])
    .filter(s.visible)
    .map((id) => ({
      ...db.students.find((x) => x.id === id)!,
      ...eligibilityFor(db, s.term.id, id),
    }))
    .filter((x) => x.name);
  const rows = all.filter(
    (x) => filter === "ALL" || x.eligible === (filter === "PASS"),
  );
  const detail = all.find((x) => x.id === selected);
  return (
    <>
      <PageHeader
        title="Xét điều kiện bảo vệ"
        description="Đối chiếu hồ sơ học vụ, đề cương, tiến độ và xác nhận cuối cùng của GVHD."
        actions={
          <Link className="btn btn-secondary" to="/defense/deferment">
            Hồ sơ bảo lưu
          </Link>
        }
      />
      <div className="stats-grid">
        <Stat
          label="Sinh viên trong đợt"
          value={all.length}
          icon={<ShieldCheck size={19} />}
        />
        <Stat
          label="Đủ điều kiện"
          value={all.filter((x) => x.eligible).length}
          icon={<CheckCircle2 size={19} />}
        />
        <Stat
          label="Cần bổ sung"
          value={all.filter((x) => !x.eligible).length}
        />
      </div>
      <Notice>
        Điều kiện được tính từ dữ liệu dùng chung. Chỉ hồ sơ đã được GVHD xác
        nhận PDF final và đủ các điều kiện mới có thể xếp lịch.
      </Notice>
      <Card title="Danh sách xét điều kiện" description={s.term?.name}>
        <DataTable
          rows={rows}
          searchText={(x) => `${x.code} ${x.name}`}
          filters={
            <select
              aria-label="Lọc điều kiện"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="ALL">Tất cả điều kiện</option>
              <option value="PASS">Đủ điều kiện</option>
              <option value="FAIL">Chưa đủ điều kiện</option>
            </select>
          }
          columns={[
            {
              key: "student",
              title: "Sinh viên",
              render: (x) => (
                <Person name={x.name} sub={`${x.code} · ${x.className}`} />
              ),
            },
            { key: "gpa", title: "GPA", render: (x) => x.gpa ?? "—" },
            {
              key: "status",
              title: "Kết luận",
              render: (x) => <Badge value={x.eligible ? "PASS" : "REVISION"} />,
            },
            {
              key: "reason",
              title: "Cần hoàn thiện",
              render: (x) => x.reasons.join("; ") || "Hồ sơ đầy đủ",
            },
            {
              key: "actions",
              title: "",
              render: (x) => (
                <Button variant="ghost" onClick={() => setSelected(x.id)}>
                  Xem điều kiện
                </Button>
              ),
            },
          ]}
        />
      </Card>
      {detail && (
        <Modal
          title={`Điều kiện · ${detail.name}`}
          onClose={() => setSelected("")}
        >
          <div className="space-y-3">
            {detail.checks.map((c) => (
              <Notice key={c.name} tone={c.pass ? "success" : "warning"}>
                <strong>
                  {c.pass ? "✓" : "!"} {c.name}
                </strong>
                <p className="text-sm mt-1">{c.detail}</p>
              </Notice>
            ))}
          </div>
          <Link
            className="btn btn-secondary mt-4"
            to="/guidance/defense-confirm"
          >
            Xem xác nhận GVHD
          </Link>
        </Modal>
      )}
    </>
  );
}
export default function EligibilityPage() {
  return <DataBoundary>{(db) => <Content db={db} />}</DataBoundary>;
}
