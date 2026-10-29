import { Eye } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Badge,
  Card,
  Empty,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { isManager } from "../../../shared/data/access";
import { AssignmentTable } from "../components/AssignmentTable";
export default function AssignmentResultPage() {
  const { db, term, termId, user } = useWorkspace();
  const rows = db.assignments.filter(
    (a) =>
      a.termId === termId &&
      a.published &&
      (isManager(user) ||
        user.studentId === a.studentId ||
        user.lecturerId === a.lecturerId),
  );
  return (
    <>
      <PageHeader
        eyebrow="BƯỚC 03 · KẾT QUẢ PHÂN CÔNG"
        title={
          user.studentId
            ? "Giảng viên hướng dẫn của tôi"
            : "Danh sách được phân công"
        }
        description={`${term.name} · Thông tin được hiển thị sau khi Khoa công bố.`}
        actions={
          term.assignmentPublished && <Badge value="APPROVED">Đã công bố</Badge>
        }
      />
      {!term.assignmentPublished ? (
        <Card>
          <Empty
            title="Kết quả chưa được công bố"
            description="Khoa đang hoàn thiện phương án. Kết quả sẽ hiển thị tại đây sau khi công bố."
          />
        </Card>
      ) : (
        <div className="stack">
          <Notice tone="success">
            Phân công đã được công bố. Hãy liên hệ giảng viên/sinh viên để thống
            nhất tên đề tài và bắt đầu lập đề cương.
          </Notice>
          <Card
            title={
              user.studentId
                ? "Thông tin liên hệ GVHD"
                : "Danh sách sinh viên & giảng viên"
            }
          >
            <AssignmentTable db={db} rows={rows} contact />
          </Card>
          {!!rows.length && (
            <div className="flex justify-end">
              <Link to="/topic/my" className="btn btn-primary">
                <Eye size={16} aria-hidden="true" />
                Xem đề tài & đề cương →
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
