import { useState } from "react";
import { Link } from "react-router-dom";
import { PanelsTopLeft, Users, Check, Minus, ShieldCheck } from "lucide-react";
import { routeManifest } from "../../../app/router/route-manifest";
import type { Role } from "../../../shared/data/types";
import {
  Badge,
  Card,
  DataTable,
  Notice,
  PageHeader,
  Stat,
  labels,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
const roles: Role[] = ["ADMIN", "FACULTY", "LECTURER", "STUDENT", "COMMITTEE"];
export default function RolesPermissionsPage() {
  const { db } = useWorkspace();
  const [selected, setSelected] = useState<Role>("FACULTY");
  const [group, setGroup] = useState("");
  const rows = routeManifest.filter(
    (r) => r.menu !== false && (!group || r.group === group),
  );
  return (
    <>
      <PageHeader
        title="Vai trò & phân quyền"
        description="Ma trận truy cập phản ánh trực tiếp các route được bảo vệ của ứng dụng."
        actions={
          <Link className="btn btn-primary" to="/admin/accounts">
            <ShieldCheck size={16} />
            Cấp vai trò cho tài khoản
          </Link>
        }
      />
      <div className="stat-grid">
        <Stat
          label="Vai trò"
          value={5}
          icon={<ShieldCheck size={18} aria-hidden="true" />}
        />
        <Stat
          label="Màn hình được bảo vệ"
          value={routeManifest.length}
          icon={<PanelsTopLeft size={18} aria-hidden="true" />}
        />
        <Stat
          label="Tài khoản nhiều vai trò"
          value={db.accounts.filter((a) => a.roles.length > 1).length}
          icon={<Users size={18} aria-hidden="true" />}
        />
        <Stat
          label="Kiểm tra quyền"
          value="RBAC"
          sub="Theo vai trò và quan hệ phân công"
          icon={<ShieldCheck size={18} aria-hidden="true" />}
        />
      </div>
      <Card
        title="Ma trận truy cập"
        description="Dấu ✓ cho phép mở màn hình. Quyền ghi còn phụ thuộc phân công, trạng thái hồ sơ và thời hạn."
      >
        <DataTable
          rows={rows}
          searchText={(r) => `${r.title} ${r.path}`}
          filters={
            <select
              aria-label="Lọc nhóm chức năng"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              <option value="">Mọi phân hệ</option>
              {[...new Set(routeManifest.map((r) => r.group))].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          }
          columns={[
            {
              key: "screen",
              title: "Chức năng",
              render: (r) => (
                <div>
                  <strong>{r.title}</strong>
                  <small className="block muted mt-1">{r.path}</small>
                </div>
              ),
            },
            ...roles.map((role) => ({
              key: role,
              title: labels[role],
              render: (r: (typeof routeManifest)[number]) =>
                r.roles.includes(role) ? (
                  <Check
                    size={18}
                    className="text-green-600"
                    aria-label="Được truy cập"
                  />
                ) : (
                  <Minus
                    size={16}
                    className="text-slate-300"
                    aria-label="Không được truy cập"
                  />
                ),
            })),
          ]}
        />
      </Card>
      <div className="mt-6">
        <Card title="Phạm vi của từng vai trò">
          <div className="tabs mb-5">
            {roles.map((role) => (
              <button
                className={`tab ${selected === role ? "active" : ""}`}
                key={role}
                onClick={() => setSelected(role)}
              >
                {labels[role]}
              </button>
            ))}
          </div>
          <Notice>
            {selected === "STUDENT"
              ? "Sinh viên thao tác hồ sơ của chính mình; kết quả phân công và điểm chỉ xem sau công bố."
              : selected === "LECTURER"
                ? "Giảng viên chỉ ghi nhận xét/điểm cho hồ sơ mình hướng dẫn, được phân phản biện hoặc trong nhóm/Hội đồng được giao."
                : selected === "COMMITTEE"
                  ? "Thành viên Hội đồng chấm đúng sinh viên trong Hội đồng; GVHD bị loại khỏi việc chấm SV của mình. Thư ký lập biên bản và Chủ tịch xác nhận theo nhiệm vụ."
                  : selected === "FACULTY"
                    ? "Giáo vụ quản lý danh mục, đợt, phân công, duyệt hồ sơ, tổ chức bảo vệ và công bố kết quả; quản trị tài khoản do Admin cấp."
                    : "Admin quản lý tài khoản và quyền hệ thống. Không được làm mất Admin cuối cùng; dữ liệu nghiệp vụ vẫn kiểm tra các ràng buộc tương ứng."}
          </Notice>
          <div className="flex flex-wrap gap-2 mt-5">
            {db.accounts
              .filter((a) => a.roles.includes(selected))
              .map((a) => (
                <Badge key={a.id}>{a.name}</Badge>
              ))}
          </div>
          <p className="muted text-sm mt-5">
            Bản demo kiểm quyền theo ma trận route và service; quyền được cấp
            bằng vai trò tài khoản. Cấu hình permission động từ backend sẽ thay
            adapter RBAC khi triển khai.
          </p>
        </Card>
      </div>
    </>
  );
}
