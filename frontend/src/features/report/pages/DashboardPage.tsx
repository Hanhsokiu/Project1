import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  FileCheck2,
  Flag,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DataBoundary,
  DataTable,
  Empty,
  Notice,
  PageHeader,
  Person,
  date,
  labels,
} from "../../../shared/components/kit";
import type { DemoDb, Role } from "../../../shared/data/types";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { hasEligibleGpa } from "../../../shared/utils/gpa";
import {
  dashboardData,
  type DashboardData,
} from "../services/dashboard-service";

function RouteButton({
  to,
  children,
  light = false,
  secondary = false,
  onClick,
}: {
  to: string;
  children: ReactNode;
  light?: boolean;
  secondary?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={
        light
          ? "inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-[#1e2024] font-semibold px-5 py-3 hover:bg-[#edeaf5] transition-colors"
          : `btn ${secondary ? "btn-secondary" : "btn-primary"}`
      }
    >
      {children}
      <ArrowRight size={16} />
    </Link>
  );
}
function DarkHero({
  label,
  title,
  description,
  children,
  actions,
}: {
  label: string;
  title: string;
  description: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[24px] bg-[#1e2024] text-white p-6 sm:p-8 mb-6 border border-[#121316]">
      <GraduationCap
        aria-hidden
        className="absolute -right-12 -bottom-16 w-72 h-72 opacity-[0.035] pointer-events-none"
        strokeWidth={1}
      />
      <div className="relative space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-[11px] tracking-[.08em] font-semibold uppercase text-[#cfbcff] mb-3">
              {label}
            </p>
            <h2 className="text-2xl sm:text-[30px] leading-tight font-semibold tracking-tight text-white">
              {title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#c6c6cb] max-w-2xl">
              {description}
            </p>
          </div>
          {actions && (
            <div className="flex flex-wrap gap-3 shrink-0">{actions}</div>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
function DarkMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/[.055] border border-white/[.04] px-5 py-4">
      <p className="text-xs text-[#c6c6cb]">{label}</p>
      <div className="flex items-baseline gap-2 mt-3">
        <strong className="text-3xl font-semibold tracking-tight text-white">
          {value}
        </strong>
        {sub && <small className="text-[#c6c6cb]">{sub}</small>}
      </div>
    </div>
  );
}
function Milestones({ data }: { data: DashboardData }) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  return (
    <Card title="Mốc thời gian" description={data.term.semester}>
      <div className="space-y-5">
        {data.phases.length ? (
          data.phases.map((phase, i) => {
            const state = phase.locked
              ? "LOCKED"
              : phase.end < today
                ? "COMPLETED"
                : phase.start <= today
                  ? "IN_PROGRESS"
                  : "PENDING";
            return (
              <div key={phase.id} className="flex gap-3 items-start">
                <span
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-semibold ${state === "IN_PROGRESS" ? "bg-[#eae6f8] text-[#523f84]" : "bg-[#f3f2f8] text-slate-500"}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <strong className="text-sm">{phase.name}</strong>
                    <Badge value={state} />
                  </div>
                  <p className="muted text-xs mt-1">
                    {date(phase.start)} – {date(phase.end)}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <Empty
            title="Chưa thiết lập kế hoạch"
            description="Các mốc đăng ký, phân công và đề cương sẽ xuất hiện sau khi Khoa cấu hình đợt."
          />
        )}
      </div>
    </Card>
  );
}
function NextDeadline({ data }: { data: DashboardData }) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const upcoming = data.phases
    .filter((p) => !p.locked && p.end >= today)
    .sort((a, b) => a.end.localeCompare(b.end));
  return (
    <Card title="Lịch công việc">
      {upcoming.length ? (
        <div className="space-y-3">
          {upcoming.map((phase) => (
            <div
              key={phase.id}
              className="flex gap-3 p-3 rounded-xl bg-[#f3f2f8]"
            >
              <CalendarDays
                size={19}
                className="text-[#665399] shrink-0 mt-1"
              />
              <div>
                <strong className="text-sm">{phase.name}</strong>
                <p className="muted text-xs mt-1">
                  Hạn hoàn thành {date(phase.end)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-[#f3f2f8] text-center p-7">
          <CalendarDays size={27} className="mx-auto text-slate-400 mb-3" />
          <strong className="text-sm">Chưa có mốc sắp tới</strong>
          <p className="muted text-xs leading-5 mt-2">
            Lịch đăng ký, phân công và nộp đề cương được cập nhật theo kế hoạch
            của đợt.
          </p>
        </div>
      )}
    </Card>
  );
}
function Sidebar({ data }: { data: DashboardData }) {
  return (
    <aside className="space-y-6">
      <Milestones data={data} />
      <NextDeadline data={data} />
    </aside>
  );
}
function QuickLink({
  title,
  description,
  to,
  icon,
}: {
  title: string;
  description: string;
  to: string;
  icon: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="block rounded-[20px] border border-[#e2e0ec] bg-white p-5 hover:bg-[#f3f2f8] transition-colors"
    >
      <span className="w-9 h-9 rounded-xl bg-[#eae6f8] text-[#665399] inline-flex items-center justify-center">
        {icon}
      </span>
      <h3 className="font-semibold text-sm mt-4 flex justify-between gap-2">
        {title}
        <ArrowRight size={16} />
      </h3>
      <p className="muted text-xs mt-2 leading-5">{description}</p>
    </Link>
  );
}

function FacultyDashboard({ data }: { data: DashboardData }) {
  const { term, students, assignments, topics, registrations } = data;
  const submitted = registrations.filter(
    (r) => r.status === "SUBMITTED",
  ).length;
  const published = term.assignmentPublished
    ? assignments.filter((a) => a.published).length
    : 0;
  const proposals = topics.filter((t) => t.versions.length > 0).length;
  const steps = [
    {
      title: "Tạo đợt, thiết lập kế hoạch và danh sách tham gia",
      to: `/terms/${term.id}`,
      done: term.status !== "DRAFT" && students.length > 0,
      detail: `${students.length} sinh viên · ${term.lecturers.length} giảng viên · ${data.phases.length} giai đoạn`,
    },
    {
      title: "Tiếp nhận hướng đồ án và nguyện vọng GVHD",
      to: "/registration/assignment",
      done: students.length > 0 && submitted >= students.length,
      detail: `${submitted}/${students.length} sinh viên đã gửi đăng ký`,
    },
    {
      title: "Phân công, công bố, thống nhất đề tài và đề cương",
      to: "/registration/assignment",
      done:
        students.length > 0 &&
        published >= students.length &&
        topics.length >= students.length &&
        topics.every((t) => t.advisorAgreed && t.versions.length > 0),
      detail: `${published} phân công công bố · ${topics.filter((t) => t.advisorAgreed).length} đề tài thống nhất · ${proposals} đề cương có phiên bản`,
    },
  ];
  const first = steps.findIndex((s) => !s.done);
  return (
    <>
      <DarkHero
        label={`ĐỢT ĐỒ ÁN HIỆN TẠI · ${term.code}`}
        title={students.length ? term.name : "Bắt đầu quản lý đợt đồ án mới"}
        description={
          students.length
            ? `${term.program} · ${term.semester}. Theo dõi kế hoạch đợt, đăng ký nguyện vọng, phân công và hồ sơ đề tài.`
            : "Thiết lập kế hoạch, nạp danh sách sinh viên đủ điều kiện và chỉ tiêu giảng viên để đưa đợt đồ án vào vận hành."
        }
        actions={
          <RouteButton
            light
            to={
              students.length ? `/terms/${term.id}` : `/terms/${term.id}/roster`
            }
          >
            {students.length ? "Chi tiết đợt đồ án" : "Chuẩn bị danh sách"}
          </RouteButton>
        }
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DarkMetric label="Sinh viên tham gia" value={students.length} />
          <DarkMetric label="Đăng ký đã gửi" value={submitted} />
          <DarkMetric label="GVHD đã công bố" value={published} />
          <DarkMetric label="Đề cương có phiên bản" value={proposals} />
        </div>
      </DarkHero>
      <div className="grid xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-6 items-start">
        <div className="space-y-6">
          <section className="rounded-[20px] bg-[#f3f0fa] border border-[#e2e0ec] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[#665399] text-white flex items-center justify-center">
                  <Flag size={20} />
                </span>
                <div>
                  <p className="eyebrow">HÀNH ĐỘNG CẦN LÀM</p>
                  <h2 className="font-semibold mt-1">
                    {students.length
                      ? "Điều hành đợt đồ án"
                      : "Chuẩn bị trước đợt"}
                  </h2>
                </div>
              </div>
              <RouteButton to="/terms" secondary>
                Tạo / chọn đợt
              </RouteButton>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-5">
              {[
                {
                  title: "Kế hoạch",
                  value: `${data.phases.length} giai đoạn`,
                  to: `/terms/${term.id}/phases`,
                },
                {
                  title: "Chỉ tiêu hướng dẫn",
                  value: `${term.lecturers.reduce((s, l) => s + l.quota, 0)} sinh viên`,
                  to: `/terms/${term.id}/roster`,
                },
                {
                  title: "Tham số đợt",
                  value: "Nguyện vọng · GPA · Phân công",
                  to: `/terms/${term.id}/parameters`,
                },
              ].map((item) => (
                <Link
                  key={item.title}
                  to={item.to}
                  className="rounded-xl bg-white p-3"
                >
                  <strong className="text-sm">{item.title}</strong>
                  <p className="muted text-xs mt-1">{item.value}</p>
                </Link>
              ))}
            </div>
          </section>
          <Card
            title="Quy trình điều hành đợt"
            description="Bước 1–3 · Mỗi sinh viên thực hiện một đề tài độc lập"
          >
            <div className="space-y-3">
              {steps.map((step, i) => (
                <Link
                  to={step.to}
                  key={step.title}
                  className={`flex items-start justify-between gap-3 rounded-2xl p-4 transition-colors ${i === first ? "bg-[#eae6f8]" : "bg-[#f3f2f8] hover:bg-[#edeaf5]"}`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs ${step.done ? "bg-[#665399] text-white" : "bg-white text-[#665399]"}`}
                    >
                      {step.done ? <Check size={15} /> : i + 1}
                    </span>
                    <div>
                      <span className="text-sm font-semibold">
                        {step.title}
                      </span>
                      <p className="text-xs muted mt-2 leading-5">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] muted shrink-0">
                    {step.done
                      ? "Hoàn tất"
                      : i === first
                        ? "Đang thực hiện"
                        : "Theo kế hoạch"}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
          <div className="grid sm:grid-cols-3 gap-4">
            <QuickLink
              title="Quản lý sinh viên"
              description="Danh sách học vụ, liên hệ và điều kiện tham gia."
              to="/catalog/students"
              icon={<GraduationCap size={20} />}
            />
            <QuickLink
              title="Quản lý giảng viên"
              description="Hướng chuyên môn, danh sách tham gia và quota."
              to="/catalog/lecturers"
              icon={<Users size={20} />}
            />
            <QuickLink
              title="Đề tài và đề cương"
              description="Theo dõi hồ sơ cá nhân và biểu mẫu PDF."
              to="/topic/overview"
              icon={<FileCheck2 size={20} />}
            />
          </div>
        </div>
        <Sidebar data={data} />
      </div>
    </>
  );
}

function StudentDashboard({ data, db }: { data: DashboardData; db: DemoDb }) {
  const { user } = useWorkspace();
  const student = db.students.find((s) => s.id === user.studentId);
  const registration = data.registrations[0],
    topic = data.topics[0],
    assignment = data.assignments[0];
  const lecturer = db.lecturers.find((l) => l.id === assignment?.lecturerId);
  const submittedProposal = !!topic?.versions.length;
  const steps = [
    {
      title: "Hoàn tất hồ sơ",
      done: !!student?.email && !!student.phone,
      to: "/profile",
    },
    {
      title: "Đăng ký hướng và NV",
      done: registration?.status === "SUBMITTED",
      to: "/registration",
    },
    { title: "Kết quả GVHD", done: !!assignment, to: "/registration/result" },
    {
      title: "Thống nhất đề tài",
      done: !!topic?.advisorAgreed,
      to: "/topic/my",
    },
    {
      title: "Đề cương và PDF",
      done: submittedProposal,
      to: "/topic/draft",
    },
  ];
  const first = steps.find((s) => !s.done);
  const eligible =
    !!student?.eligible &&
    hasEligibleGpa(
      student.gpa,
      data.term.parameters.passing_gpa_threshold ?? 2,
    );
  const title = !data.students.length
    ? "Chưa thuộc danh sách tham gia đợt"
    : !eligible
      ? "Chưa đủ điều kiện học vụ"
      : submittedProposal
        ? "Đề cương đã có phiên bản được nộp"
        : topic?.advisorAgreed
          ? "Đã thống nhất đề tài với GVHD"
          : assignment
            ? "Đã được phân công GVHD"
            : registration?.status === "SUBMITTED"
              ? "Đã đăng ký · chờ phân công"
              : "Chưa đăng ký";
  const target =
    !data.students.length || !eligible
      ? "/profile"
      : first?.to || "/topic/overview";
  return (
    <>
      <DarkHero
        label={`TRẠNG THÁI HỒ SƠ ĐỒ ÁN · ${steps.filter((s) => s.done).length}/5 MỐC`}
        title={title}
        description={
          topic?.title ||
          (registration
            ? "Thông tin đăng ký được lưu theo đợt. Kết quả phân công chỉ hiển thị sau khi Khoa công bố."
            : "Chọn một hướng đồ án và tối đa ba nguyện vọng giảng viên trong thời hạn mở cổng của Khoa.")
        }
        actions={
          <RouteButton light to={target}>
            {!data.students.length || !eligible
              ? "Kiểm tra hồ sơ"
              : !registration
                ? "Bắt đầu đăng ký"
                : first
                  ? first.title
                  : "Xem hồ sơ đề cương"}
          </RouteButton>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {steps.slice(1).map((step, i) => (
            <div
              key={step.title}
              className="rounded-xl bg-white/[.05] px-3 py-3"
            >
              <p className="text-[10px] uppercase text-[#cfbcff] font-semibold">
                Mốc {i + 1}
              </p>
              <p className="text-xs font-medium mt-2">{step.title}</p>
              <p className="text-[10px] text-[#c6c6cb] mt-2">
                {step.done ? "Đã hoàn tất" : "Chờ thực hiện"}
              </p>
            </div>
          ))}
        </div>
      </DarkHero>
      <div className="grid xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-6 items-start">
        <div className="space-y-6">
          <section className="rounded-[24px] border border-[#e2e0ec] bg-[#f3f0fa] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="w-9 h-9 rounded-xl bg-[#665399] text-white flex items-center justify-center mb-3">
                  <GraduationCap size={20} />
                </span>
                <p className="eyebrow">BƯỚC TIẾP THEO</p>
                <h2 className="text-xl font-semibold mt-2">
                  {first?.title || "Kiểm tra và xuất đề cương"}
                </h2>
                <p className="muted text-sm leading-6 mt-3 max-w-xl">
                  {!registration
                    ? `Hoàn tất email/số điện thoại, chọn 1 trong ${db.catalogs.filter((c) => c.kind === "direction" && c.active).length} hướng đang hoạt động và sắp xếp NV1, NV2, NV3.`
                    : topic?.advisorAgreed
                      ? "Nhập mục tiêu, phạm vi, công nghệ, kết quả dự kiến và kế hoạch theo tuần. Lưu nháp, nộp phiên bản và xuất biểu mẫu PDF."
                      : "Theo dõi kết quả đăng ký, liên hệ GVHD sau khi Khoa công bố và trao đổi để thống nhất một đề tài cá nhân."}
                </p>
              </div>
              <RouteButton to={target}>Mở hồ sơ</RouteButton>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-5">
              <div className="bg-white rounded-xl p-3 text-xs">
                <strong>Học vụ</strong>
                <p className="muted mt-1">GPA {student?.gpa ?? "—"} / 4.0</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-xs">
                <strong>Hạn đăng ký</strong>
                <p className="muted mt-1">{date(data.term.registrationEnd)}</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-xs">
                <strong>Thông tin liên hệ</strong>
                <p className="muted mt-1">
                  {student?.email && student.phone
                    ? "Đã có email và điện thoại"
                    : "Cần hoàn tất hồ sơ cá nhân"}
                </p>
              </div>
            </div>
          </section>
          <div className="grid md:grid-cols-3 gap-4">
            <Card title="Giảng viên hướng dẫn">
              {lecturer ? (
                <div className="space-y-3">
                  <Person name={lecturer.name} sub={lecturer.code} />
                  <a
                    className="text-xs text-[#665399] break-all block"
                    href={`mailto:${lecturer.email}`}
                  >
                    {lecturer.email}
                  </a>
                  <p className="muted text-xs">{lecturer.phone}</p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-sm">Chưa được phân công</p>
                  <p className="muted text-xs mt-3 leading-5">
                    Thông tin GVHD xuất hiện sau khi Khoa công bố quyết định
                    phân công.
                  </p>
                </div>
              )}
            </Card>
            <Card title="Đề tài tốt nghiệp">
              {topic ? (
                <div>
                  <Badge value={topic.advisorAgreed ? "APPROVED" : "PENDING"}>
                    {topic.advisorAgreed
                      ? "GVHD đã thống nhất"
                      : "Chờ GVHD thống nhất"}
                  </Badge>
                  <p className="font-semibold text-sm mt-3 leading-6">
                    {topic.title}
                  </p>
                  <Link
                    className="text-xs text-[#665399] block mt-3"
                    to="/topic/my"
                  >
                    Chi tiết đề tài →
                  </Link>
                </div>
              ) : (
                <p className="muted text-sm leading-6">
                  Trao đổi với GVHD sau phân công để thống nhất đề tài cá nhân.
                </p>
              )}
            </Card>
            <Card title="Hồ sơ đề cương">
              <strong className="text-3xl">
                {topic?.versions.length || 0}
              </strong>
              <p className="muted text-xs mt-2">phiên bản đã nộp</p>
              <div className="my-4">
                <Badge value={submittedProposal ? "SUBMITTED" : "DRAFT"} />
              </div>
              <Link to="/topic/draft" className="text-xs text-[#665399]">
                Soạn đề cương / xuất PDF →
              </Link>
            </Card>
          </div>
          <Card
            title="Lộ trình đăng ký và hồ sơ đề tài"
            description="Các mốc trong Bước 1–3 · Hồ sơ cá nhân trong đợt hiện tại"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {steps.map((step, i) => (
                <Link
                  key={step.title}
                  to={step.to}
                  className={`p-4 rounded-2xl text-center border ${step.done ? "border-[#cfbcff] bg-[#f3f0fa]" : "border-[#e2e0ec] bg-[#f9f9fa]"}`}
                >
                  <span className="flex w-10 h-10 rounded-xl bg-white mx-auto items-center justify-center text-[#665399]">
                    {step.done ? (
                      <CheckCircle2 size={21} />
                    ) : (
                      <span className="font-semibold">{i + 1}</span>
                    )}
                  </span>
                  <strong className="text-xs block mt-3">{step.title}</strong>
                  <p className="text-[10px] muted mt-2">
                    {step.done ? "Hoàn tất" : "Chờ thực hiện"}
                  </p>
                </Link>
              ))}
            </div>
          </Card>
        </div>
        <Sidebar data={data} />
      </div>
    </>
  );
}

function LecturerDashboard({ data, db }: { data: DashboardData; db: DemoDb }) {
  const { setStudentId } = useWorkspace();
  const department = db.catalogs.find(
    (c) => c.id === data.lecturer?.departmentId,
  );
  const agreed = data.topics.filter((t) => t.advisorAgreed).length;
  const submitted = data.topics.filter((t) => t.versions.length > 0).length;
  return (
    <>
      <DarkHero
        label={`TỔNG QUAN HƯỚNG DẪN ĐỒ ÁN · ${data.term.code}`}
        title={
          data.students.length
            ? "Đồng hành cùng sinh viên xây dựng đề tài"
            : "Sẵn sàng nhận phân công hướng dẫn"
        }
        description={
          data.students.length
            ? `${data.students.length} sinh viên đã có quyết định phân công. Trao đổi thông tin liên hệ, thống nhất đề tài và kiểm tra hồ sơ đề cương.`
            : "Khoa chưa công bố sinh viên được giao cho bạn trong đợt này. Danh sách sẽ được cập nhật sau khi chốt và công bố phân công."
        }
      >
        <div className="grid sm:grid-cols-3 gap-3">
          <DarkMetric
            label="Sinh viên được giao"
            value={data.students.length}
            sub={`/ ${data.quota} chỉ tiêu`}
          />
          <DarkMetric label="Đề tài đã thống nhất" value={agreed} />
          <DarkMetric label="Đề cương có phiên bản" value={submitted} />
        </div>
        <div className="rounded-xl bg-white/[.06] p-4 text-xs flex flex-wrap justify-between gap-3">
          <span>
            Chỉ tiêu trong đợt: {data.students.length}/{data.quota} sinh viên
          </span>
          <span className="text-[#cfbcff]">
            {data.term.assignmentPublished
              ? "Khoa đã công bố kết quả phân công"
              : "Chờ Khoa chốt và công bố phân công"}
          </span>
        </div>
      </DarkHero>
      <div className="grid xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-6 items-start">
        <div className="space-y-6">
          <Card
            title="Sinh viên hướng dẫn"
            description="Chỉ hiển thị sinh viên trong phân công đã công bố"
            action={<Badge>{data.students.length} sinh viên</Badge>}
          >
            <DataTable
              rows={data.students}
              searchText={(s) => `${s.code} ${s.name}`}
              emptyTitle="Chưa có sinh viên được phân công"
              columns={[
                {
                  key: "student",
                  title: "Sinh viên",
                  render: (s) => <Person name={s.name} sub={s.code} />,
                },
                {
                  key: "contact",
                  title: "Liên hệ",
                  render: (s) => (
                    <div className="text-xs space-y-1">
                      <a className="text-[#665399]" href={`mailto:${s.email}`}>
                        {s.email}
                      </a>
                      <p>{s.phone}</p>
                    </div>
                  ),
                },
                {
                  key: "topic",
                  title: "Đề tài",
                  render: (s) => {
                    const t = data.topics.find((t) => t.studentId === s.id);
                    return (
                      <div>
                        <p className="text-sm max-w-xs line-clamp-2">
                          {t?.title || "Chưa có đề tài"}
                        </p>
                        <div className="mt-1">
                          <Badge
                            value={t?.advisorAgreed ? "APPROVED" : "PENDING"}
                          >
                            {t?.advisorAgreed
                              ? "Đã thống nhất"
                              : "Chờ trao đổi"}
                          </Badge>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: "action",
                  title: "Thao tác",
                  render: (s) => (
                    <RouteButton
                      to="/topic/my"
                      secondary
                      onClick={() => setStudentId(s.id)}
                    >
                      Mở đề tài
                    </RouteButton>
                  ),
                },
              ]}
            />
          </Card>
          <Card title="Thông tin chuyên môn và hướng nghiên cứu">
            <div className="rounded-2xl bg-[#f3f2f8] p-4 grid sm:grid-cols-2 gap-4">
              <div>
                <p className="eyebrow">GIẢNG VIÊN HƯỚNG DẪN</p>
                <strong className="block mt-2">
                  {data.lecturer?.name || "Chưa có hồ sơ giảng viên"}
                </strong>
                <p className="muted text-xs mt-2">{data.lecturer?.code}</p>
              </div>
              <div>
                <p className="eyebrow">BỘ MÔN PHỤ TRÁCH</p>
                <strong className="block mt-2">
                  {department?.name || "Chưa cập nhật"}
                </strong>
                <p className="muted text-xs mt-2">
                  Quota đợt: {data.quota} sinh viên
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {data.lecturer?.directionIds.map((id) => (
                <Badge key={id}>
                  {db.catalogs.find((c) => c.id === id)?.name || id}
                </Badge>
              ))}
            </div>
            <div className="mt-5">
              <RouteButton to="/catalog/lecturers" secondary>
                Xem hồ sơ giảng viên
              </RouteButton>
            </div>
          </Card>
          <div className="grid md:grid-cols-2 gap-6">
            <Card
              title="Đề tài chờ thống nhất"
              action={
                <Badge>
                  {data.topics.filter((t) => !t.advisorAgreed).length}
                </Badge>
              }
            >
              {data.topics.some((t) => !t.advisorAgreed) ? (
                <div className="space-y-3">
                  {data.topics
                    .filter((t) => !t.advisorAgreed)
                    .map((topic) => (
                      <Link
                        to="/topic/my"
                        onClick={() => setStudentId(topic.studentId)}
                        key={topic.id}
                        className="block rounded-xl bg-[#f3f2f8] p-3"
                      >
                        <strong className="text-sm">
                          {
                            db.students.find((s) => s.id === topic.studentId)
                              ?.name
                          }
                        </strong>
                        <p className="muted text-xs mt-2">{topic.title}</p>
                      </Link>
                    ))}
                </div>
              ) : (
                <Empty
                  title="Không có đề tài đang chờ"
                  description="Đề tài cần trao đổi sẽ hiển thị khi sinh viên cập nhật sau phân công."
                />
              )}
            </Card>
            <Card title="Hồ sơ đề cương">
              <div className="space-y-3">
                <div className="flex justify-between rounded-xl bg-[#f3f2f8] p-3 text-sm">
                  <span>Đã có phiên bản nộp</span>
                  <strong className="text-[#665399]">{submitted}</strong>
                </div>
                <div className="flex justify-between rounded-xl bg-[#f3f2f8] p-3 text-sm">
                  <span>Chưa nộp phiên bản</span>
                  <strong className="text-[#665399]">
                    {Math.max(0, data.students.length - submitted)}
                  </strong>
                </div>
                <RouteButton to="/topic/overview" secondary>
                  Xem hồ sơ và PDF
                </RouteButton>
              </div>
            </Card>
          </div>
        </div>
        <Sidebar data={data} />
      </div>
    </>
  );
}

function AdminDashboard({ db }: { db: DemoDb }) {
  return (
    <>
      <DarkHero
        label="QUẢN TRỊ HỆ THỐNG · GPMS UTC"
        title="Không gian quản trị hệ thống"
        description="Quản lý tài khoản, vai trò và quyền truy cập; theo dõi hoạt động trên hệ thống đồ án tốt nghiệp."
        actions={
          <RouteButton light to="/admin/accounts">
            Quản lý tài khoản
          </RouteButton>
        }
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DarkMetric label="Tổng tài khoản" value={db.accounts.length} />
          <DarkMetric
            label="Tài khoản bị khóa"
            value={db.accounts.filter((a) => a.locked).length}
          />
          <DarkMetric
            label="Cần đổi mật khẩu"
            value={db.accounts.filter((a) => a.mustChangePassword).length}
          />
          <DarkMetric label="Bản ghi hoạt động" value={db.audits.length} />
        </div>
      </DarkHero>
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <QuickLink
          title="Tài khoản và đăng nhập"
          description="Tạo tài khoản, khóa/mở và đặt lại mật khẩu."
          to="/admin/accounts"
          icon={<Users size={20} />}
        />
        <QuickLink
          title="Vai trò và quyền"
          description="Kiểm tra quyền của năm vai trò trong hệ thống."
          to="/admin/roles"
          icon={<ShieldCheck size={20} />}
        />
        <QuickLink
          title="Nhật ký hoạt động"
          description="Tra cứu người thực hiện, thao tác và thời gian."
          to="/admin/audit-logs"
          icon={<LockKeyhole size={20} />}
        />
      </div>
      <div className="space-y-6">
        <Card title="Hoạt động gần đây">
          <DataTable
            rows={db.audits.slice(0, 20)}
            searchText={(a) => `${a.actor} ${a.action} ${a.detail}`}
            columns={[
              {
                key: "at",
                title: "Thời gian",
                render: (a) =>
                  new Date(a.at).toLocaleString("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                  }),
              },
              {
                key: "actor",
                title: "Người thực hiện",
                render: (a) => a.actor,
              },
              {
                key: "action",
                title: "Thao tác",
                render: (a) => <strong>{a.action}</strong>,
              },
              {
                key: "detail",
                title: "Nội dung",
                render: (a) => <p className="max-w-sm text-sm">{a.detail}</p>,
              },
            ]}
          />
        </Card>
      </div>
    </>
  );
}

function DashboardContent({ db }: { db: DemoDb }) {
  const { user, termId } = useWorkspace();
  const availableRoles = user.roles.filter((r) => r !== "COMMITTEE");
  const [selectedRole, setSelectedRole] = useState<Role>(
    availableRoles[0] || user.roles[0],
  );
  const role = availableRoles.some((item) => item === selectedRole)
    ? selectedRole
    : availableRoles[0];
  if (!role)
    return (
      <Notice>
        Chưa có không gian làm việc cho tài khoản này trong giai đoạn đăng ký và
        phân công. Liên hệ quản trị viên để kiểm tra vai trò.
      </Notice>
    );
  if (!db.terms.length)
    return (
      <>
        <PageHeader
          eyebrow="GPMS · KHÔNG GIAN LÀM VIỆC"
          title="Chưa có đợt đồ án"
          description="Khoa chưa tạo đợt đồ án trên hệ thống."
        />
        <Card>
          <Empty
            title={
              user.roles.some((r) => r === "ADMIN" || r === "FACULTY")
                ? "Bắt đầu thiết lập đợt đồ án"
                : "Chưa có đợt để đăng ký"
            }
            description={
              user.roles.some((r) => r === "ADMIN" || r === "FACULTY")
                ? "Tạo kỳ học và đợt, sau đó thiết lập giai đoạn, sinh viên đủ điều kiện và chỉ tiêu giảng viên."
                : "Thông tin đăng ký và phân công sẽ xuất hiện sau khi Khoa thiết lập đợt."
            }
            action={
              user.roles.some((r) => r === "ADMIN" || r === "FACULTY") ? (
                <RouteButton to="/terms">Tạo đợt đồ án</RouteButton>
              ) : undefined
            }
          />
        </Card>
      </>
    );
  const data = dashboardData(db, user, termId, role);
  const student = db.students.find((s) => s.id === user.studentId);
  const lecturer = db.lecturers.find((l) => l.id === user.lecturerId);
  return (
    <>
      <PageHeader
        eyebrow={`GPMS · KHOA CÔNG NGHỆ THÔNG TIN · ${labels[role]}`}
        title={`Xin chào, ${user.name}!`}
        description={
          role === "STUDENT"
            ? `${student?.code || user.username} · ${student?.className || "Hồ sơ sinh viên"} · ${data.term.program}`
            : role === "LECTURER"
              ? `${lecturer?.code || user.username} · ${db.catalogs.find((c) => c.id === lecturer?.departmentId)?.name || "Khoa Công nghệ Thông tin"}`
              : "Tổng quan công tác quản lý đợt, đăng ký và hồ sơ đề tài"
        }
        actions={<Badge value={data.term.status} />}
      />
      {availableRoles.length > 1 && (
        <div
          className="flex flex-wrap gap-2 mb-6"
          aria-label="Không gian vai trò"
        >
          {availableRoles.map((item) => (
            <Button
              key={item}
              variant={role === item ? "primary" : "secondary"}
              onClick={() => setSelectedRole(item)}
            >
              {labels[item]}
            </Button>
          ))}
        </div>
      )}
      {role === "ADMIN" ? (
        <AdminDashboard db={db} />
      ) : role === "FACULTY" ? (
        <FacultyDashboard data={data} />
      ) : role === "STUDENT" ? (
        <StudentDashboard db={db} data={data} />
      ) : (
        <LecturerDashboard db={db} data={data} />
      )}
    </>
  );
}
export default function DashboardPage() {
  return <DataBoundary>{(db) => <DashboardContent db={db} />}</DataBoundary>;
}
