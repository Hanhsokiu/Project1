import { Link } from "react-router-dom";
import { Button, Notice } from "../../../shared/components/kit";
import { useAssignmentWindow } from "../hooks/use-assignment-window";

const formatTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(value))
    : "Chưa cấu hình";

export default function AssignmentWindowNotice({
  termId,
  window,
}: {
  termId: string;
  window: ReturnType<typeof useAssignmentWindow>;
}) {
  return (
    <Notice tone={window.blockedReason ? "warning" : "info"}>
      <div className="stack">
        <strong>
          {window.blockedReason || "Giai đoạn phân công đang mở."}
        </strong>
        {window.data && (
          <div>
            Thời gian phân công: {formatTime(window.data.startAt)} đến{" "}
            {formatTime(window.data.endAt)} (giờ Việt Nam).
          </div>
        )}
        <div>
          <Link to={`/terms/${termId}/phases`}>
            Xem lịch giai đoạn phân công
          </Link>
          {window.isError && (
            <Button
              type="button"
              variant="secondary"
              disabled={window.isFetching}
              onClick={() => void window.refetch()}
            >
              Kiểm tra lại
            </Button>
          )}
        </div>
      </div>
    </Notice>
  );
}
