import type { DemoDb, Topic } from "../../../shared/data/types";
import { labels } from "../../../shared/components/kit";
import { STEP3_API } from "../../registration/services/assignment-api";
export function proposalLines(db: DemoDb, topic: Topic, degree = "Cử nhân") {
  const s = db.students.find((s) => s.id === topic.studentId);
  const l = db.lecturers.find((l) => l.id === topic.lecturerId);
  const term = db.terms.find((t) => t.id === topic.termId);
  const department = db.catalogs.find((c) => c.id === l?.departmentId);
  return [
    `ĐỀ CƯƠNG ĐỒ ÁN TỐT NGHIỆP ${degree.toLocaleUpperCase("vi")}`,
    `Đợt: ${term?.code} – ${term?.name}`,
    `Sinh viên: ${s?.name}     Mã sinh viên: ${s?.code}`,
    `Lớp: ${s?.className}     Hệ đào tạo: ${term?.program || s?.program}`,
    `Ngành: Công nghệ thông tin     Email: ${s?.email}     SĐT: ${s?.phone}`,
    `Giảng viên hướng dẫn: ${l?.name}`,
    `Đơn vị: ${department?.name || "Khoa CNTT – UTC"}     Email: ${l?.email}     SĐT: ${l?.phone}`,
    "",
    `1. Tên đề tài: ${topic.title}`,
    `2. Mục tiêu: ${topic.objectives}`,
    `3. Nội dung và phạm vi: ${topic.scope}`,
    `4. Công nghệ, công cụ, ngôn ngữ: ${topic.technology}`,
    `5. Kết quả dự kiến: ${topic.expected}`,
    "6. Kế hoạch thực hiện:",
    ...topic.plan.map((p, i) => `${i + 1}. Tuần ${p.week}: ${p.content}`),
    "",
    `Tình trạng: ${labels[topic.status] || topic.status} · GVHD ${topic.advisorAgreed ? "đã" : "chưa"} thống nhất đề tài`,
    `Phiên bản đã nộp: ${topic.versions.length || "Chưa nộp"}`,
    "",
    "Ngày ...... tháng ...... năm ........",
    "TRƯỞNG KHOA              TRƯỞNG BỘ MÔN",
    "(Ký, ghi rõ họ tên)           (Ký, ghi rõ họ tên)",
    "",
    "GIẢNG VIÊN HƯỚNG DẪN              SINH VIÊN",
    "(Ký, ghi rõ họ tên)                   (Ký, ghi rõ họ tên)",
  ];
}
export function ProposalDocument({
  db,
  topic,
  degree = "Cử nhân",
}: {
  db: DemoDb;
  topic: Topic;
  degree?: string;
}) {
  const s = db.students.find((s) => s.id === topic.studentId);
  const l = db.lecturers.find((l) => l.id === topic.lecturerId);
  const t = db.terms.find((t) => t.id === topic.termId);
  return (
    <article className="document-preview">
      <div className="text-center text-xs leading-6">
        <p>TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI</p>
        <b>KHOA CÔNG NGHỆ THÔNG TIN</b>
        <p>——————————</p>
      </div>
      <h2>Đề cương đồ án tốt nghiệp {degree}</h2>
      <p>
        <b>1. Thông tin sinh viên</b>
      </p>
      <p>
        Họ và tên: {s?.name} · Mã SV: {s?.code}
        <br />
        Lớp: {s?.className} · Hệ: {t?.program || s?.program}
        <br />
        Ngành: Công nghệ thông tin
        <br />
        SĐT: {s?.phone} · Email: {s?.email}
      </p>
      <h3>2. Giảng viên hướng dẫn</h3>
      <p>
        {l?.name} · {db.catalogs.find((c) => c.id === l?.departmentId)?.name}
        <br />
        SĐT: {l?.phone} · Email: {l?.email}
      </p>
      <h3>3. Tên đề tài</h3>
      <p>{topic.title || "Chưa nhập tên đề tài"}</p>
      <h3>4. Mục tiêu</h3>
      <p>{topic.objectives}</p>
      <h3>5. Nội dung và phạm vi</h3>
      <p>{topic.scope}</p>
      <h3>6. Công nghệ, công cụ, ngôn ngữ</h3>
      <p>{topic.technology}</p>
      <h3>7. Kết quả dự kiến</h3>
      <p>{topic.expected}</p>
      <h3>8. Kế hoạch thực hiện</h3>
      <table>
        <thead>
          <tr>
            <th>STT</th>
            <th>Công việc</th>
            <th>Thời gian</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {topic.plan.map((p, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{p.content}</td>
              <td>Tuần {p.week}</td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-right mt-6">Ngày ...... tháng ...... năm ........</p>
      <div className="signature-grid">
        <b>TRƯỞNG KHOA</b>
        <b>TRƯỞNG BỘ MÔN</b>
        <b>GV HƯỚNG DẪN</b>
        <b>SINH VIÊN</b>
      </div>
      <p className="text-center muted text-xs">
        {labels[topic.status]} · {t?.code} ·{" "}
        {STEP3_API
          ? "Bản xem trước — PDF lấy từ phiên bản đã lưu"
          : "Bản xem trước từ dữ liệu demo"}
      </p>
    </article>
  );
}
