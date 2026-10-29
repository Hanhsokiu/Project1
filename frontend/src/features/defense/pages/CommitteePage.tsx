import { Pencil, Trash2, Plus, X, Save } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  DataBoundary,
  Empty,
  Field,
  Modal,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import type { Committee, DemoDb } from "../../../shared/data/types";
import { useDefenseScope } from "../components/DefenseScope";
import { saveCommittee } from "../services/defense-service";
function Content({ db }: { db: DemoDb }) {
  const s = useDefenseScope(db);
  const [draft, setDraft] = useState<Committee>();
  const committees = db.committees.filter((c) => c.termId === s.term?.id);
  const update = (
    index: number,
    patch: Partial<Committee["members"][number]>,
  ) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            members: d.members.map((m, i) =>
              i === index ? { ...m, ...patch } : m,
            ),
          }
        : d,
    );
  return (
    <>
      <PageHeader
        title="Hội đồng bảo vệ"
        description="Thành lập hội đồng 3–5 giảng viên, có chủ tịch, thư ký và các ủy viên."
        actions={
          s.faculty && (
            <Button
              onClick={() =>
                setDraft({
                  id: "",
                  termId: s.term.id,
                  name: "",
                  room: "",
                  members: [
                    { lecturerId: "", role: "CHAIR" },
                    { lecturerId: "", role: "SECRETARY" },
                    { lecturerId: "", role: "MEMBER" },
                  ],
                })
              }
            >
              <Plus size={16} aria-hidden="true" />
              Thành lập hội đồng
            </Button>
          )
        }
      />
      <Notice>
        GVHD không tham gia hội đồng chấm sinh viên mình hướng dẫn. Hệ thống
        kiểm tra lại ràng buộc khi phân công phản biện và xếp lịch.
      </Notice>
      {!committees.length ? (
        <Card>
          <Empty title="Chưa có hội đồng trong đợt" />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {committees.map((c) => (
            <Card
              key={c.id}
              title={c.name}
              description={`Phòng ${c.room} · ${s.defenses.filter((d) => d.committeeId === c.id).length} sinh viên`}
              action={
                s.faculty && (
                  <Button
                    variant="ghost"
                    onClick={() => setDraft(structuredClone(c))}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    Chỉnh sửa
                  </Button>
                )
              }
            >
              <div className="space-y-3">
                {c.members.map((m) => (
                  <div
                    className="flex justify-between gap-4 items-center"
                    key={m.lecturerId}
                  >
                    <span>{s.lecturer(m.lecturerId)}</span>
                    <Badge value={m.role} />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
      {draft && (
        <Modal
          title={draft.id ? "Chỉnh sửa hội đồng" : "Thành lập hội đồng"}
          onClose={() => setDraft(undefined)}
          wide
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              s.exec(() => {
                saveCommittee(draft);
                setDraft(undefined);
              });
            }}
          >
            <div className="form-grid">
              <Field label="Tên hội đồng">
                <input
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Phòng mặc định">
                <input
                  required
                  value={draft.room}
                  onChange={(e) => setDraft({ ...draft, room: e.target.value })}
                />
              </Field>
            </div>
            <h3 className="my-4 font-semibold">Thành viên hội đồng</h3>
            {draft.members.map((m, i) => (
              <div className="flex flex-wrap gap-3 mb-3" key={i}>
                <select
                  className="flex-1 min-w-48"
                  aria-label={`Giảng viên ${i + 1}`}
                  value={m.lecturerId}
                  required
                  onChange={(e) => update(i, { lecturerId: e.target.value })}
                >
                  <option value="">Chọn giảng viên</option>
                  {s.term.lecturers.map((l) => (
                    <option key={l.lecturerId} value={l.lecturerId}>
                      {s.lecturer(l.lecturerId)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Vai trò ${i + 1}`}
                  value={m.role}
                  onChange={(e) =>
                    update(i, { role: e.target.value as typeof m.role })
                  }
                >
                  <option value="CHAIR">Chủ tịch</option>
                  <option value="SECRETARY">Thư ký</option>
                  <option value="MEMBER">Ủy viên</option>
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={draft.members.length <= 3}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      members: draft.members.filter((_, j) => i !== j),
                    })
                  }
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Xóa
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              disabled={draft.members.length >= 5}
              onClick={() =>
                setDraft({
                  ...draft,
                  members: [
                    ...draft.members,
                    { lecturerId: "", role: "MEMBER" },
                  ],
                })
              }
            >
              <Plus size={16} aria-hidden="true" />
              Thêm ủy viên
            </Button>
            <div className="dialog-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDraft(undefined)}
              >
                <X size={16} aria-hidden="true" />
                Hủy
              </Button>
              <Button disabled={s.pending}>
                <Save size={16} aria-hidden="true" />
                Lưu hội đồng
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export default function CommitteePage() {
  return <DataBoundary>{(db) => <Content db={db} />}</DataBoundary>;
}
