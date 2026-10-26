import type { DemoDb, Term, Topic } from "./types";
export const DEMO_VERSION = 3;
export const parameters = {
  process_weight: 0.4,
  committee_weight: 0.6,
  advisor_weight_in_process: 0.5,
  reviewer_weight_in_process: 0.5,
  min_pass_score: 5,
  passing_gpa_threshold: 2,
  max_preferences: 3,
  min_weekly_pass_rate: 0.8,
};
export function createSeed(
  includeDemoData = typeof import.meta !== "undefined" &&
    import.meta.env?.MODE === "test",
): DemoDb {
  const directions = ["Phần mềm", "Game", "Kiểm thử", "Học máy", "Mạng"];
  if (!includeDemoData) {
    return {
      version: DEMO_VERSION,
      accounts: [
        {
          id: "admin",
          username: "admin",
          name: "Quản trị hệ thống",
          email: "admin@utc.edu.vn",
          phone: "0901000000",
          roles: ["ADMIN"],
          password: "Demo@2026",
          locked: false,
          mustChangePassword: false,
        },
      ],
      catalogs: [
        {
          id: "bm1",
          kind: "department",
          code: "CNPM",
          name: "Công nghệ phần mềm",
          active: true,
        },
        {
          id: "bm2",
          kind: "department",
          code: "KHMT",
          name: "Khoa học máy tính",
          active: true,
        },
        ...directions.map((name, i) => ({
          id: `h${i + 1}`,
          kind: "direction" as const,
          code: `HD${i + 1}`,
          name,
          active: true,
        })),
        ...["Chính quy", "Liên thông", "Từ xa"].map((name, i) => ({
          id: `he${i + 1}`,
          kind: "program" as const,
          code: `HE${i + 1}`,
          name,
          active: true,
        })),
        {
          id: "hk1",
          kind: "semester",
          code: "2026-1",
          name: "2026 – 2027 / Học kỳ I",
          active: true,
        },
      ],
      students: [],
      lecturers: [],
      terms: [],
      registrations: [],
      assignments: [],
      topics: [],
      reviewGroups: [],
      plans: [],
      tasks: [],
      meetings: [],
      finals: [],
      deferments: [],
      committees: [],
      defenses: [],
      scores: [],
      rubrics: {
        advisor: [
          { id: "attitude", name: "Ý thức và thái độ thực hiện", max: 2 },
          { id: "work", name: "Kết quả thực hiện và sản phẩm", max: 5 },
          { id: "report", name: "Báo cáo và tính thực tiễn", max: 3 },
        ],
        reviewer: [
          { id: "format", name: "Bố cục và hình thức", max: 2 },
          { id: "content", name: "Nội dung báo cáo", max: 3 },
          { id: "practical", name: "Ý nghĩa thực tiễn", max: 1 },
          { id: "complete", name: "Tính hoàn thiện", max: 2 },
          { id: "mastery", name: "Khả năng làm chủ sản phẩm", max: 2 },
        ],
        committee: [
          { id: "report", name: "Nội dung báo cáo", max: 3 },
          { id: "product", name: "Sản phẩm và trình diễn", max: 3 },
          { id: "present", name: "Trình bày và trả lời câu hỏi", max: 3 },
          { id: "form", name: "Hình thức", max: 1 },
        ],
      },
      exports: [],
      notifications: [],
      audits: [],
    };
  }
  const lecturerNames = [
    "TS. Nguyễn Minh Đức",
    "ThS. Trần Thu Hà",
    "TS. Lê Hoàng Nam",
    "ThS. Phạm Thanh Tâm",
    "TS. Vũ Quang Huy",
    "ThS. Đỗ Mai Anh",
    "TS. Bùi Anh Tuấn",
    "ThS. Nguyễn Lan Chi",
  ];
  const names = [
    "Nguyễn Minh Anh",
    "Trần Hoàng Bảo",
    "Lê Khánh Chi",
    "Phạm Tiến Dũng",
    "Hoàng Ngọc Hà",
    "Vũ Đức Hùng",
    "Đỗ Thu Hương",
    "Bùi Gia Huy",
    "Nguyễn Hải Linh",
    "Trần Quang Minh",
    "Phan Bảo Ngọc",
    "Lê Minh Phúc",
    "Đặng Anh Quân",
    "Ngô Phương Thảo",
    "Võ Anh Thư",
    "Phạm Quốc Việt",
  ];
  const students = names.map((name, i) => ({
    id: `sv${i + 1}`,
    code: `221230${String(i + 1).padStart(3, "0")}`,
    name,
    email: `sv${i + 1}@st.utc.edu.vn`,
    phone: `091234${String(i + 1).padStart(4, "0")}`,
    className: i % 2 ? "CNTT 2 – K63" : "CNTT 1 – K63",
    program: "Chính quy",
    departmentId: "bm1",
    gpa: i === 15 ? 1.8 : Math.round((3.8 - i * 0.11) * 100) / 100,
    eligible: i !== 15,
  }));
  const lecturers = lecturerNames.map((name, i) => ({
    id: `gv${i + 1}`,
    code: `GV${String(i + 1).padStart(3, "0")}`,
    name,
    email: `gv${i + 1}@utc.edu.vn`,
    phone: `098765${String(i + 1).padStart(4, "0")}`,
    departmentId: i < 5 ? "bm1" : "bm2",
    directionIds:
      i < 3
        ? ["h1", "h2", "h3", "h4", "h5"]
        : i < 5
          ? ["h2", "h5"]
          : ["h1", "h2", "h3", "h4", "h5"],
    quota: 6,
  }));
  const term: Term = {
    id: "dot1",
    code: "DATN-2026-1",
    name: "Đồ án tốt nghiệp · Học kỳ I",
    semester: "2026 – 2027 / Học kỳ I",
    program: "Chính quy",
    status: "IN_PROGRESS",
    start: "2026-09-01",
    end: "2027-01-30",
    registrationStart: "2026-09-01",
    registrationEnd: "2026-09-20",
    locked: false,
    studentIds: students.filter((s) => s.eligible).map((s) => s.id),
    lecturers: lecturers.map((l) => ({ lecturerId: l.id, quota: 6 })),
    phases: ["Đăng ký nguyện vọng", "Phân công GVHD", "Lập & nộp đề cương"].map(
      (name, i) => ({
        id: `gd${i + 1}`,
        name,
        start: [
          "2026-09-01",
          "2026-09-21",
          "2026-09-25",
          "2026-10-01",
          "2027-01-01",
          "2027-01-15",
        ][i],
        end: [
          "2026-09-20",
          "2026-09-24",
          "2026-10-10",
          "2026-12-31",
          "2027-01-14",
          "2027-01-30",
        ][i],
        locked: i < 2,
      }),
    ),
    parameters: { ...parameters },
    assignmentPublished: true,
    resultsPublished: false,
  };
  const assignments = students
    .slice(0, 15)
    .map((s, i) => ({
      id: `pc${i + 1}`,
      termId: "dot1",
      studentId: s.id,
      lecturerId: `gv${(i % 3) + 1}`,
      preference: (i % 4) + 1,
      manual: false,
      reason: "",
      published: true,
    }));
  const titles = [
    "Xây dựng hệ thống quản lý đồ án tốt nghiệp",
    "Ứng dụng đặt vé giao thông thông minh",
    "Hệ thống nhận diện biển số xe",
    "Nền tảng học trực tuyến tích hợp AI",
    "Ứng dụng quản lý phòng khám",
    "Hệ thống giám sát an ninh mạng",
    "Ứng dụng phân tích cảm xúc tiếng Việt",
    "Xây dựng cổng thông tin tuyển dụng",
  ];
  const topics: Topic[] = assignments.map((a, i) => ({
    id: `dt${i + 1}`,
    termId: a.termId,
    studentId: a.studentId,
    lecturerId: a.lecturerId,
    directionId: `h${(i % 5) + 1}`,
    title: titles[i % titles.length],
    advisorAgreed: i !== 4,
    status: i < 8 ? "DRAFT" : "SUBMITTED",
    objectives:
      "Xây dựng ứng dụng đáp ứng nhu cầu thực tế, tự động hóa quy trình và nâng cao trải nghiệm người dùng.",
    scope:
      "Khảo sát nghiệp vụ, thiết kế dữ liệu, xây dựng ứng dụng web và kiểm thử với dữ liệu mẫu.",
    technology: "React, TypeScript, NestJS, PostgreSQL",
    expected:
      "Ứng dụng hoạt động, mã nguồn, báo cáo và tài liệu hướng dẫn sử dụng.",
    plan: [
      { week: "1–3", content: "Khảo sát, phân tích và thiết kế hệ thống" },
      { week: "4–10", content: "Xây dựng chức năng và kiểm thử" },
      { week: "11–15", content: "Hoàn thiện báo cáo và chuẩn bị bảo vệ" },
    ],
    versions: [
      {
        version: 1,
        at: "2026-10-01T08:00:00+07:00",
        title: titles[i % titles.length],
        objectives: "Xây dựng ứng dụng",
        scope: "Ứng dụng web",
        technology: "React, NestJS",
        expected: "Báo cáo và mã nguồn",
        plan: [{ week: "1–15", content: "Triển khai đề tài" }],
        status: "SUBMITTED",
        comment:
          i === 3 ? "Bổ sung phạm vi đánh giá và phương án kiểm thử." : "",
      },
    ],
    groupId: "nd1",
    comment: i === 3 ? "Bổ sung phạm vi đánh giá và phương án kiểm thử." : "",
  }));
  return {
    version: DEMO_VERSION,
    accounts: [
      {
        id: "admin",
        username: "admin",
        name: "Quản trị hệ thống",
        email: "admin@utc.edu.vn",
        phone: "0901000000",
        roles: ["ADMIN"],
        password: "Demo@2026",
        locked: false,
        mustChangePassword: false,
      },
      {
        id: "khoa",
        username: "giaovu",
        name: "Nguyễn Thị Hạnh",
        email: "giaovu@utc.edu.vn",
        phone: "0901000001",
        roles: ["FACULTY"],
        password: "Demo@2026",
        locked: false,
        mustChangePassword: false,
      },
      ...lecturers.map((l, i) => ({
        id: l.id,
        username: l.code.toLowerCase(),
        name: l.name,
        email: l.email,
        phone: l.phone,
        roles:
          i >= 3
            ? (["LECTURER", "COMMITTEE"] as ("LECTURER" | "COMMITTEE")[])
            : (["LECTURER"] as "LECTURER"[]),
        password: "Demo@2026",
        locked: false,
        mustChangePassword: false,
        lecturerId: l.id,
      })),
      ...students.map((s) => ({
        id: s.id,
        username: s.code,
        name: s.name,
        email: s.email,
        phone: s.phone,
        roles: ["STUDENT"] as "STUDENT"[],
        password: s.code,
        locked: false,
        mustChangePassword: true,
        studentId: s.id,
      })),
    ],
    catalogs: [
      {
        id: "bm1",
        kind: "department",
        code: "CNPM",
        name: "Công nghệ phần mềm",
        active: true,
      },
      {
        id: "bm2",
        kind: "department",
        code: "KHMT",
        name: "Khoa học máy tính",
        active: true,
      },
      ...directions.map((name, i) => ({
        id: `h${i + 1}`,
        kind: "direction" as const,
        code: `HD${i + 1}`,
        name,
        active: true,
      })),
      ...["Chính quy", "Liên thông", "Từ xa"].map((name, i) => ({
        id: `he${i + 1}`,
        kind: "program" as const,
        code: `HE${i + 1}`,
        name,
        active: true,
      })),
      {
        id: "hk1",
        kind: "semester",
        code: "2026-1",
        name: "2026 – 2027 / Học kỳ I",
        active: true,
      },
    ],
    students,
    lecturers,
    terms: [
      term,
      {
        ...structuredClone(term),
        id: "dot2",
        code: "DATN-2026-2",
        name: "Đợt đăng ký mới · Học kỳ I",
        program: "Chính quy",
        status: "OPEN_REGISTRATION",
        start: "2026-10-01",
        end: "2027-03-31",
        registrationStart: "2026-10-01",
        registrationEnd: "2026-11-30",
        phases: [
          {
            id: "gd21",
            name: "Đăng ký nguyện vọng",
            start: "2026-10-01",
            end: "2026-11-30",
            locked: false,
          },
          {
            id: "gd22",
            name: "Phân công GVHD",
            start: "2026-12-01",
            end: "2026-12-10",
            locked: false,
          },
          {
            id: "gd23",
            name: "Lập & nộp đề cương",
            start: "2026-12-11",
            end: "2027-03-31",
            locked: false,
          },
        ],
        assignmentPublished: false,
        resultsPublished: false,
      },
      {
        ...structuredClone(term),
        id: "dot3",
        code: "DATN-LT-2026",
        name: "Đợt đồ án hệ Liên thông",
        program: "Liên thông",
        status: "DRAFT",
        studentIds: [],
        assignmentPublished: false,
        resultsPublished: false,
      },
      {
        ...structuredClone(term),
        id: "dot4",
        code: "DATN-TX-2026",
        name: "Đợt đồ án hệ Từ xa",
        program: "Từ xa",
        status: "DRAFT",
        studentIds: [],
        assignmentPublished: false,
        resultsPublished: false,
      },
    ],
    registrations: assignments.map((a, i) => ({
      id: `dk${i + 1}`,
      termId: "dot1",
      studentId: a.studentId,
      directionId: `h${(i % 5) + 1}`,
      preferences: [
        a.lecturerId,
        `gv${((i + 1) % 3) + 1}`,
        `gv${((i + 2) % 3) + 1}`,
      ],
      note: "",
      status: "SUBMITTED",
      updatedAt: "2026-09-12T08:00:00+07:00",
    })),
    assignments,
    topics,
    reviewGroups: [
      {
        id: "nd1",
        termId: "dot1",
        name: "Tổ duyệt Công nghệ phần mềm",
        departmentId: "bm1",
        lecturerIds: ["gv1", "gv2", "gv3"],
      },
    ],
    plans: assignments
      .slice(0, 3)
      .map((a, i) => ({
        id: `kh${i}`,
        termId: a.termId,
        studentId: a.studentId,
        lecturerId: a.lecturerId,
        content:
          "Hướng dẫn hàng tuần vào thứ Sáu. Nộp báo cáo và source code trước buổi họp.",
        milestones:
          "Tuần 4: thiết kế; tuần 8: bản thử nghiệm; tuần 15: hoàn thiện.",
        updatedAt: "2026-10-01",
      })),
    tasks: assignments.slice(0, 5).flatMap((a, i) =>
      [1, 2, 3].map((week) => ({
        id: `nv${i}-${week}`,
        termId: a.termId,
        studentId: a.studentId,
        lecturerId: a.lecturerId,
        week,
        title: [
          "Phân tích yêu cầu & Use case",
          "Thiết kế cơ sở dữ liệu",
          "Xây dựng giao diện chức năng",
        ][week - 1],
        description:
          "Hoàn thành công việc theo đề cương. Nộp báo cáo PDF và mã nguồn dưới dạng ZIP hoặc liên kết repository.",
        deadline: `2026-10-${String(week * 7 + 1).padStart(2, "0")}`,
        progress: week < 3 ? 100 : 50,
        submissions:
          week < 3
            ? [
                {
                  id: `bn${i}-${week}`,
                  at: "2026-10-10T10:00:00+07:00",
                  content: "Em đã hoàn thành các nội dung theo kế hoạch.",
                  files: [
                    {
                      name: "bao-cao-tuan.txt",
                      size: 65,
                      type: "text/plain",
                      dataUrl:
                        "data:text/plain;charset=utf-8,Bao%20cao%20tien%20do%20tuan%20-%20hoan%20thanh%20phan%20tich%20va%20thiet%20ke.",
                    },
                    {
                      name: "Source code",
                      size: 0,
                      type: "text/uri-list",
                      url: "https://github.com/topics/graduation-project",
                    },
                  ],
                  status: i === 3 ? ("REVISION" as const) : ("PASS" as const),
                  feedback:
                    i === 3
                      ? "Bổ sung sơ đồ hoạt động."
                      : "Đạt yêu cầu. Tiếp tục theo kế hoạch.",
                },
              ]
            : [],
      })),
    ),
    meetings: [
      {
        id: "hop1",
        termId: "dot1",
        studentId: "sv1",
        lecturerId: "gv1",
        at: "2026-10-16T09:00",
        location: "Phòng 305 – Nhà A8",
        content: "Trao đổi thiết kế dữ liệu và tiến độ giao diện.",
        conclusion: "Hoàn thiện bản demo trước buổi hướng dẫn tiếp theo.",
      },
    ],
    finals: [],
    deferments: [],
    committees: [
      {
        id: "hd1",
        termId: "dot1",
        name: "Hội đồng 01 · Công nghệ phần mềm",
        members: [
          { lecturerId: "gv4", role: "CHAIR" },
          { lecturerId: "gv5", role: "SECRETARY" },
          { lecturerId: "gv6", role: "MEMBER" },
        ],
        room: "A8-301",
      },
    ],
    defenses: [],
    scores: [],
    rubrics: {
      advisor: [
        { id: "attitude", name: "Ý thức và thái độ thực hiện", max: 2 },
        { id: "work", name: "Kết quả thực hiện và sản phẩm", max: 5 },
        { id: "report", name: "Báo cáo và tính thực tiễn", max: 3 },
      ],
      reviewer: [
        { id: "format", name: "Bố cục và hình thức", max: 2 },
        { id: "content", name: "Nội dung báo cáo", max: 3 },
        { id: "practical", name: "Ý nghĩa thực tiễn", max: 1 },
        { id: "complete", name: "Tính hoàn thiện", max: 2 },
        { id: "mastery", name: "Khả năng làm chủ sản phẩm", max: 2 },
      ],
      committee: [
        { id: "report", name: "Nội dung báo cáo", max: 3 },
        { id: "product", name: "Sản phẩm và trình diễn", max: 3 },
        { id: "present", name: "Trình bày và trả lời câu hỏi", max: 3 },
        { id: "form", name: "Hình thức", max: 1 },
      ],
    },
    exports: [],
    notifications: [
      {
        id: "tb1",
        termId: "dot1",
        userId: "sv1",
        title: "Kết quả phân công GVHD",
        content:
          "Bạn được phân công TS. Nguyễn Minh Đức hướng dẫn. Vui lòng liên hệ thống nhất đề tài.",
        status: "SENT",
        read: false,
      },
      {
        id: "tb2",
        termId: "dot1",
        userId: "gv2",
        title: "Thông báo phân công",
        content: "Email chưa gửi được. Giáo vụ có thể gửi lại.",
        status: "FAILED",
        read: false,
      },
    ],
    audits: [
      {
        id: "log1",
        at: "2026-10-22T08:30:00+07:00",
        actor: "Nguyễn Thị Hạnh",
        action: "Khởi tạo dữ liệu demo",
        detail: "Đợt DATN-2026-1 • dữ liệu dùng chung toàn hệ thống",
      },
    ],
  };
}
