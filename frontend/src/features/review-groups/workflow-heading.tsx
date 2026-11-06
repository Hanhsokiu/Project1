import { useWorkspace } from "../../shared/hooks/use-workspace";
import { routeManifest, routeTitle } from "../../app/router/route-manifest";

const descriptions: Record<string, Record<string, string>> = {
  "/topic/review-groups": {
    FACULTY: "Tổ chức nhóm duyệt và phân công thành viên theo đợt, bộ môn.",
    LECTURER: "Xem nhóm duyệt bạn tham gia và các thành viên được phân công.",
  },
  "/topic/reviews": {
    FACULTY:
      "Theo dõi hồ sơ, phân công nhóm duyệt và kiểm tra kết quả xét duyệt.",
    LECTURER:
      "Đọc đề cương, ghi nhận xét và kết luận trong các vòng được phân công.",
    STUDENT:
      "Theo dõi kết quả và nhận xét cho đề cương của bạn. Mở đề cương để chỉnh sửa khi được yêu cầu.",
  },
  "/topic/proposal": {
    FACULTY: "Tra cứu nội dung và lịch sử phiên bản trong phạm vi phụ trách.",
    LECTURER:
      "Xem đề cương và lịch sử của sinh viên thuộc phạm vi hướng dẫn hoặc xét duyệt.",
    STUDENT:
      "Soạn đề cương, lưu phiên bản và gửi duyệt. Các bản đã gửi được giữ nguyên trong lịch sử.",
  },
  "/topic/dossier": {
    FACULTY:
      "Kiểm tra bản đã duyệt, chốt hồ sơ chính thức và xác nhận tiếp nhận bản giấy.",
    LECTURER:
      "Tra cứu bản chốt và hồ sơ chính thức của sinh viên trong phạm vi phụ trách.",
    STUDENT:
      "Theo dõi trạng thái hồ sơ và tải bản PDF chính thức để in, ký, nộp cho Khoa.",
  },
  "/guidance/plan": {
    FACULTY: "Xem kế hoạch hướng dẫn của sinh viên trong phạm vi quản lý.",
    LECTURER:
      "Lập kế hoạch, giao nhiệm vụ và ghi nhật ký cho sinh viên bạn đang hướng dẫn.",
    STUDENT: "Xem kế hoạch, yêu cầu và nhật ký hướng dẫn của bạn.",
  },
  "/guidance/tasks": {
    FACULTY: "Tra cứu nhiệm vụ và tiến độ trong phạm vi quản lý.",
    LECTURER:
      "Theo dõi nhiệm vụ của sinh viên, cập nhật yêu cầu và kiểm tra bài nộp.",
    STUDENT:
      "Xem việc cần làm, cập nhật tiến độ, nộp báo cáo và đọc góp ý của giảng viên.",
  },
};

export function WorkflowHeading({ path }: { path: string }) {
  const { user } = useWorkspace();
  const route = routeManifest.find((item) => item.path === path)!;
  const role = user.roles.find((item) => descriptions[path]?.[item]);
  return (
    <header className="workflow-page-heading">
      <span className="workflow-eyebrow">{route.group}</span>
      <h1>{routeTitle(route, user)}</h1>
      {role && <p>{descriptions[path][role]}</p>}
    </header>
  );
}
