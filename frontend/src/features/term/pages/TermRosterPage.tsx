import { UserCheck, GraduationCap, Users, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Term } from "../../../shared/data/types";
import {
  Back,
  Badge,
  Button,
  Card,
  DataTable,
  Notice,
  PageHeader,
  Person,
  Stat,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import { termService } from "../services/term-service";
import { formatGpa, hasEligibleGpa } from "../../../shared/utils/gpa";
export default function TermRosterPage() {
  const { id } = useParams();
  const { db } = useWorkspace();
  const t = db.terms.find((t) => t.id === id);
  const action = useAction();
  const [tab, setTab] = useState<"students" | "lecturers">("students");
  const [students, setStudents] = useState<string[]>(() => [
    ...(t?.studentIds || []),
  ]);
  const [lecturers, setLecturers] = useState<Term["lecturers"]>(() =>
    structuredClone(t?.lecturers || []),
  );
  const [selectedOnly, setSelectedOnly] = useState(false);
  useEffect(() => {
    setStudents([...(t?.studentIds || [])]);
    setLecturers(structuredClone(t?.lecturers || []));
  }, [t?.id, t?.studentIds, t?.lecturers]);
  if (!t)
    return (
      <Card>
        <Notice tone="danger">Không tìm thấy đợt.</Notice>
        <Back to="/terms" />
      </Card>
    );
  const disabled = t.locked || ["COMPLETED", "CANCELLED"].includes(t.status);
  const dirty =
    JSON.stringify(students) !== JSON.stringify(t.studentIds) ||
    JSON.stringify(lecturers) !== JSON.stringify(t.lecturers);
  const compatible = db.students.filter((s) => s.program === t.program);
  const eligible = compatible.filter(
    (s) =>
      s.eligible && hasEligibleGpa(s.gpa, t.parameters.passing_gpa_threshold),
  );
  const studentRows = compatible.filter(
    (s) => !selectedOnly || students.includes(s.id),
  );
  const lecturerRows = db.lecturers.filter(
    (l) => !selectedOnly || lecturers.some((x) => x.lecturerId === l.id),
  );
  const toggleStudent = (studentId: string, checked: boolean) =>
    setStudents(
      checked
        ? [...new Set([...students, studentId])]
        : students.filter((x) => x !== studentId),
    );
  const toggleLecturer = (
    lecturerId: string,
    checked: boolean,
    quota: number,
  ) =>
    setLecturers(
      checked
        ? [
            ...lecturers.filter((x) => x.lecturerId !== lecturerId),
            { lecturerId, quota },
          ]
        : lecturers.filter((x) => x.lecturerId !== lecturerId),
    );
  return (
    <>
      <Back to={`/terms/${t.id}`} />
      <PageHeader
        title="Danh sách tham gia đợt"
        description={`${t.code} · Hệ ${t.program} · Quota được tính riêng cho từng GV trong đợt.`}
        actions={
          <Link to="/catalog/import" className="btn btn-secondary">
            Import danh sách
          </Link>
        }
      />
      <div className="stat-grid">
        <Stat
          icon={<UserCheck size={18} />}
          label="SV đã chọn"
          value={students.length}
        />
        <Stat
          icon={<GraduationCap size={18} />}
          label="SV cùng hệ đủ điều kiện"
          value={eligible.length}
        />
        <Stat
          icon={<Users size={18} />}
          label="GV tham gia"
          value={lecturers.length}
        />
        <Stat
          icon={<Target size={18} />}
          label="Tổng chỉ tiêu"
          value={lecturers.reduce((sum, l) => sum + l.quota, 0)}
        />
      </div>
      {disabled && (
        <div className="mb-5">
          <Notice tone="warning">
            Đợt đã khóa hoặc kết thúc. Danh sách hiện ở chế độ xem.
          </Notice>
        </div>
      )}
      <div className="tabs mb-5">
        <button
          className={`tab ${tab === "students" ? "active" : ""}`}
          onClick={() => {
            setTab("students");
            setSelectedOnly(false);
          }}
        >
          Sinh viên đủ điều kiện
        </button>
        <button
          className={`tab ${tab === "lecturers" ? "active" : ""}`}
          onClick={() => {
            setTab("lecturers");
            setSelectedOnly(false);
          }}
        >
          Giảng viên & quota
        </button>
      </div>
      {tab === "students" ? (
        <Card
          title="Sinh viên cùng hệ đào tạo"
          action={
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() =>
                setStudents([
                  ...new Set([...students, ...eligible.map((s) => s.id)]),
                ])
              }
            >
              Chọn tất cả đủ điều kiện
            </Button>
          }
        >
          <DataTable
            rows={studentRows}
            searchText={(s) => `${s.code} ${s.name} ${s.className}`}
            filters={
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedOnly}
                  onChange={(e) => setSelectedOnly(e.target.checked)}
                />
                Chỉ SV đã chọn
              </label>
            }
            columns={[
              {
                key: "select",
                title: "Chọn",
                render: (s) => (
                  <input
                    aria-label={`Thêm ${s.code} vào đợt`}
                    type="checkbox"
                    checked={students.includes(s.id)}
                    disabled={
                      disabled ||
                      (!students.includes(s.id) &&
                        (!s.eligible ||
                          !hasEligibleGpa(
                            s.gpa,
                            t.parameters.passing_gpa_threshold,
                          )))
                    }
                    onChange={(e) => toggleStudent(s.id, e.target.checked)}
                  />
                ),
              },
              {
                key: "student",
                title: "Sinh viên",
                render: (s) => <Person name={s.name} sub={s.code} />,
              },
              { key: "class", title: "Lớp", render: (s) => s.className },
              { key: "gpa", title: "GPA / 4", render: (s) => formatGpa(s.gpa) },
              {
                key: "state",
                title: "Điều kiện",
                render: (s) => (
                  <Badge
                    value={
                      s.eligible &&
                      hasEligibleGpa(s.gpa, t.parameters.passing_gpa_threshold)
                        ? "PASS"
                        : "FAIL"
                    }
                  >
                    {!s.eligible
                      ? "Chưa đạt học vụ"
                      : s.gpa === null
                        ? "Chưa có GPA"
                        : !hasEligibleGpa(
                              s.gpa,
                              t.parameters.passing_gpa_threshold,
                            )
                          ? "Dưới ngưỡng GPA"
                          : "Đủ điều kiện"}
                  </Badge>
                ),
              },
              {
                key: "assigned",
                title: "Phân công",
                render: (s) =>
                  db.assignments.some(
                    (a) => a.termId === t.id && a.studentId === s.id,
                  )
                    ? "Đã có GVHD"
                    : "Chưa phân công",
              },
            ]}
          />
        </Card>
      ) : (
        <Card title="Giảng viên tham gia">
          <DataTable
            rows={lecturerRows}
            searchText={(l) => `${l.code} ${l.name}`}
            filters={
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedOnly}
                  onChange={(e) => setSelectedOnly(e.target.checked)}
                />
                Chỉ GV đã chọn
              </label>
            }
            columns={[
              {
                key: "select",
                title: "Tham gia",
                render: (l) => (
                  <input
                    aria-label={`Chọn giảng viên ${l.code}`}
                    type="checkbox"
                    checked={lecturers.some((x) => x.lecturerId === l.id)}
                    disabled={disabled}
                    onChange={(e) =>
                      toggleLecturer(l.id, e.target.checked, l.quota)
                    }
                  />
                ),
              },
              {
                key: "lecturer",
                title: "Giảng viên",
                render: (l) => <Person name={l.name} sub={l.code} />,
              },
              {
                key: "directions",
                title: "Hướng chuyên môn",
                render: (l) =>
                  l.directionIds
                    .map((d) => db.catalogs.find((c) => c.id === d)?.name)
                    .join(", "),
              },
              {
                key: "load",
                title: "Tải hiện tại",
                render: (l) =>
                  db.assignments.filter(
                    (a) => a.termId === t.id && a.lecturerId === l.id,
                  ).length,
              },
              {
                key: "quota",
                title: "Quota trong đợt",
                render: (l) => (
                  <input
                    className="max-w-24"
                    aria-label={`Quota ${l.code}`}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    disabled={
                      disabled || !lecturers.some((x) => x.lecturerId === l.id)
                    }
                    value={
                      lecturers.find((x) => x.lecturerId === l.id)?.quota ??
                      l.quota
                    }
                    onChange={(e) =>
                      setLecturers(
                        lecturers.map((x) =>
                          x.lecturerId === l.id
                            ? { ...x, quota: Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                  />
                ),
              },
            ]}
          />
        </Card>
      )}
      <div className="mt-5">
        <Notice>
          Chỉ SV hệ {t.program}, đã xác minh học vụ và GPA ≥{" "}
          {t.parameters.passing_gpa_threshold.toFixed(2)} được thêm. Sau công bố
          phân công, không loại SV/GV đang có kết quả hoặc giảm quota dưới tải.
        </Notice>
      </div>
      <div className="form-actions">
        <Button
          variant="secondary"
          disabled={disabled || !dirty}
          onClick={() => {
            setStudents([...t.studentIds]);
            setLecturers(structuredClone(t.lecturers));
          }}
        >
          Khôi phục
        </Button>
        <Button
          disabled={disabled || !dirty || action.pending}
          onClick={() =>
            action
              .run(() => termService.saveRoster(t.id, students, lecturers))
              .catch(() => {})
          }
        >
          Lưu danh sách tham gia
        </Button>
      </div>
    </>
  );
}
