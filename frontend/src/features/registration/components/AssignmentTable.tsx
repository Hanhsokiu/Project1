import { Badge, DataTable, Person } from "../../../shared/components/kit";
import type { Assignment, DemoDb } from "../../../shared/data/types";
export function AssignmentTable({
  db,
  rows,
  contact = false,
}: {
  db: DemoDb;
  rows: Assignment[];
  contact?: boolean;
}) {
  return (
    <DataTable
      rows={rows}
      searchText={(a) => {
        const s = db.students.find((s) => s.id === a.studentId);
        const l = db.lecturers.find((l) => l.id === a.lecturerId);
        return `${s?.code} ${s?.name} ${l?.name}`;
      }}
      columns={[
        {
          key: "student",
          title: "Sinh viên",
          render: (a) => {
            const s = db.students.find((s) => s.id === a.studentId)!;
            return (
              <Person
                name={s?.name || "—"}
                sub={`${s?.code || ""} · ${s?.className || ""}`}
              />
            );
          },
        },
        {
          key: "direction",
          title: "Hướng đồ án",
          render: (a) => {
            const r = db.registrations.find(
              (r) => r.termId === a.termId && r.studentId === a.studentId,
            );
            return (
              db.catalogs.find(
                (c) =>
                  c.id ===
                  (r?.directionId ??
                    (a as Assignment & { directionId?: string }).directionId),
              )?.name || "—"
            );
          },
        },
        {
          key: "lecturer",
          title: "Giảng viên hướng dẫn",
          render: (a) => {
            const l = db.lecturers.find((l) => l.id === a.lecturerId);
            return (
              <div>
                <strong>{l?.name}</strong>
                {contact && (
                  <div className="text-xs leading-6 mt-1">
                    <a href={`mailto:${l?.email}`}>{l?.email}</a>
                    <br />
                    <a href={`tel:${l?.phone}`}>{l?.phone}</a>
                  </div>
                )}
              </div>
            );
          },
        },
        {
          key: "preference",
          title: "Kết quả",
          render: (a) => (
            <Badge
              value={
                a.manual
                  ? "REVISION"
                  : a.preference <= 3
                    ? "APPROVED"
                    : "SUBMITTED"
              }
            >
              {a.manual
                ? "Điều chỉnh thủ công"
                : a.preference <= 3
                  ? `Nguyện vọng ${a.preference}`
                  : "Tự phân theo hướng"}
            </Badge>
          ),
        },
        ...(contact
          ? [
              {
                key: "contact",
                title: "Liên hệ sinh viên",
                render: (a: Assignment) => {
                  const s = db.students.find((s) => s.id === a.studentId);
                  return (
                    <div className="text-xs leading-6">
                      <a href={`mailto:${s?.email}`}>{s?.email}</a>
                      <br />
                      <a href={`tel:${s?.phone}`}>{s?.phone}</a>
                    </div>
                  );
                },
              },
            ]
          : []),
      ]}
    />
  );
}
