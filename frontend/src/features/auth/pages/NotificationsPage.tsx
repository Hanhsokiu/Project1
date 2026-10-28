import { useState } from "react";
import { Bell, MailCheck } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Notice,
  PageHeader,
  Stat,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import { notificationService } from "../services/notification-service";
import { registrationService } from "../../registration/services/registration-service";
import { STEP3_API } from "../../registration/services/assignment-api";
export default function NotificationsPage() {
  const { db, user, term } = useWorkspace();
  const action = useAction();
  const manager = user.roles.some((r) => r === "ADMIN" || r === "FACULTY");
  const [tab, setTab] = useState<"inbox" | "delivery">("inbox");
  const [filter, setFilter] = useState("");
  const mine = db.notifications.filter(
    (n) => n.userId === user.id && n.channel !== "EMAIL",
  );
  const rows = (
    tab === "inbox"
      ? mine
      : db.notifications.filter(
          (n) => n.termId === term.id && n.channel !== "IN_APP",
        )
  ).filter(
    (n) => !filter || (filter === "UNREAD" ? !n.read : n.status === filter),
  );
  return (
    <>
      <PageHeader
        title="Trung tâm thông báo"
        description="Theo dõi hồ sơ, kết quả phân công và trạng thái gửi thông báo trong đợt."
        actions={
          <Button
            variant="secondary"
            disabled={action.pending || !mine.some((n) => !n.read)}
            onClick={() =>
              action.run(() => notificationService.readAll()).catch(() => {})
            }
          >
            <MailCheck size={16} />
            Đánh dấu đã đọc tất cả
          </Button>
        }
      />
      <div className="stat-grid">
        <Stat label="Thông báo của bạn" value={mine.length} icon={<Bell />} />
        <Stat label="Chưa đọc" value={mine.filter((n) => !n.read).length} />
        <Stat
          label="Thông báo trong đợt"
          value={
            manager
              ? db.notifications.filter((n) => n.termId === term.id).length
              : mine.filter((n) => n.termId === term.id).length
          }
        />
        <Stat
          label="Gửi thất bại"
          value={
            (manager ? db.notifications : mine).filter(
              (n) => n.status === "FAILED",
            ).length
          }
        />
      </div>
      {manager && (
        <div className="tabs mb-5">
          <button
            className={`tab ${tab === "inbox" ? "active" : ""}`}
            onClick={() => {
              setTab("inbox");
              setFilter("");
            }}
          >
            Hộp thư của tôi
          </button>
          <button
            className={`tab ${tab === "delivery" ? "active" : ""}`}
            onClick={() => {
              setTab("delivery");
              setFilter("");
            }}
          >
            Theo dõi gửi thông báo
          </button>
        </div>
      )}
      <Card
        title={
          tab === "inbox" ? "Thông báo nhận được" : `Thông báo · ${term.code}`
        }
      >
        <DataTable
          rows={rows}
          searchText={(n) =>
            `${n.title} ${n.content} ${db.accounts.find((a) => a.id === n.userId)?.name}`
          }
          filters={
            <select
              value={filter}
              aria-label="Lọc thông báo"
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {tab === "inbox" && <option value="UNREAD">Chưa đọc</option>}
              <option value="SENT">Đã gửi</option>
              <option value="FAILED">Thất bại</option>
              <option value="PENDING">Đang chờ</option>
            </select>
          }
          columns={[
            {
              key: "title",
              title: "Thông báo",
              render: (n) => (
                <div>
                  <strong>{n.title}</strong>
                  <p className="text-wrap mt-2">{n.content}</p>
                </div>
              ),
            },
            {
              key: "recipient",
              title: "Người nhận",
              render: (n) =>
                db.accounts.find((a) => a.id === n.userId)?.name || n.userId,
            },
            {
              key: "state",
              title: "Trạng thái",
              render: (n) => (
                <div>
                  <Badge value={n.status} />
                  {tab === "inbox" && (
                    <small className="block muted mt-2">
                      {n.read ? "Đã đọc" : "Chưa đọc"}
                    </small>
                  )}
                </div>
              ),
            },
            {
              key: "actions",
              title: "Thao tác",
              render: (n) => (
                <div className="flex gap-2">
                  {n.userId === user.id &&
                    n.link?.startsWith("/") &&
                    !n.link.startsWith("//") && (
                      <Link className="btn btn-secondary" to={n.link}>
                        Mở hồ sơ
                      </Link>
                    )}
                  {n.userId === user.id && !n.read && (
                    <Button
                      variant="ghost"
                      disabled={action.pending}
                      onClick={() =>
                        action
                          .run(() => notificationService.read(n.id))
                          .catch(() => {})
                      }
                    >
                      Đã đọc
                    </Button>
                  )}
                  {manager && n.status === "FAILED" && (
                    <Button
                      variant="secondary"
                      disabled={action.pending}
                      onClick={() =>
                        action
                          .run(() =>
                            registrationService.retryNotification(n.id),
                          )
                          .catch(() => {})
                      }
                    >
                      Gửi lại
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
      <div className="mt-5">
        <Notice>
          {STEP3_API
            ? "Thông báo được lưu trên máy chủ. Trạng thái email SENT chỉ được ghi sau khi SMTP chấp nhận thư; trạng thái đã đọc được quản lý riêng."
            : "Thông báo và email đang được mô phỏng trong lớp dữ liệu demo."}
        </Notice>
      </div>
    </>
  );
}
