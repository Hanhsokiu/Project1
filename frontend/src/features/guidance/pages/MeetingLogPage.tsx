import { useState } from "react";
import { X, Save, Eye, Pencil, Trash2, CalendarDays, Plus } from "lucide-react";
import {
  Button,
  Card,
  Confirm,
  DataBoundary,
  DataTable,
  Field,
  Modal,
  Notice,
  PageHeader,
  date,
} from "../../../shared/components/kit";
import type { DemoDb, Meeting } from "../../../shared/data/types";
import { useAction } from "../../../shared/hooks/use-demo";
import {
  guidanceService,
  type MeetingInput,
} from "../services/guidance-service";
import {
  ActionError,
  GuidanceSelector,
  type GuidanceContext,
  useGuidance,
} from "../components/guidance-kit";

function MeetingEditor({
  context,
  meeting,
  onClose,
}: {
  context: GuidanceContext;
  meeting?: Meeting;
  onClose: () => void;
}) {
  const action = useAction();
  const [form, setForm] = useState<MeetingInput>({
    at: meeting?.at.slice(0, 16) || "",
    location: meeting?.location || "",
    content: meeting?.content || "",
    conclusion: meeting?.conclusion || "",
  });
  return (
    <Modal
      wide
      title={meeting ? "Cập nhật buổi hướng dẫn" : "Ghi nhật ký buổi hướng dẫn"}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          action
            .run(() =>
              guidanceService.saveMeeting(
                context.termId,
                context.studentId,
                { ...form, at: `${form.at}:00+07:00` },
                meeting?.id,
              ),
            )
            .then(onClose)
            .catch(() => {});
        }}
      >
        <ActionError error={action.error} />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Thời gian (giờ Việt Nam)">
            <input
              type="datetime-local"
              required
              value={form.at}
              onChange={(e) => setForm({ ...form, at: e.target.value })}
            />
          </Field>
          <Field label="Địa điểm / hình thức">
            <input
              required
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Phòng hướng dẫn hoặc họp trực tuyến"
            />
          </Field>
        </div>
        <Field label="Nội dung trao đổi">
          <textarea
            required
            rows={5}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Vấn đề đã thảo luận, kết quả kiểm tra và khó khăn…"
          />
        </Field>
        <Field label="Kết luận và việc cần làm">
          <textarea
            required
            rows={4}
            value={form.conclusion}
            onChange={(e) => setForm({ ...form, conclusion: e.target.value })}
            placeholder="Các quyết định thống nhất và công việc trước buổi tiếp theo…"
          />
        </Field>
        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            <X size={16} aria-hidden="true" />
            Hủy
          </Button>
          <Button disabled={action.pending}>
            <Save size={16} aria-hidden="true" />
            Lưu nhật ký
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function MeetingsContent({ db }: { db: DemoDb }) {
  const context = useGuidance(db);
  const { termId, studentId, student, advisor, own, locked, assignment } =
    context;
  const action = useAction();
  const [editor, setEditor] = useState<Meeting | "new" | null>(null);
  const [detailId, setDetailId] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const meetings = db.meetings
    .filter((m) => m.termId === termId && m.studentId === studentId)
    .sort((a, b) => b.at.localeCompare(a.at));
  const detail = meetings.find((m) => m.id === detailId);
  const canEdit = (advisor || own) && !locked && !!assignment;
  return (
    <>
      <PageHeader
        eyebrow="HƯỚNG DẪN ĐỒ ÁN / NHẬT KÝ"
        title="Nhật ký hướng dẫn"
        description="Ghi lại từng buổi trao đổi, nội dung đã thống nhất và nhiệm vụ sau buổi hướng dẫn."
        actions={
          canEdit && (
            <Button onClick={() => setEditor("new")}>
              <Plus size={16} />
              Ghi buổi hướng dẫn
            </Button>
          )
        }
      />
      <GuidanceSelector context={context} />
      {student && (
        <Card
          title="Lịch sử buổi hướng dẫn"
          description={`${meetings.length} buổi trao đổi được lưu trong hồ sơ sinh viên`}
        >
          <DataTable
            rows={meetings}
            searchText={(m) => `${m.location} ${m.content} ${m.conclusion}`}
            emptyTitle="Chưa ghi nhận buổi hướng dẫn"
            columns={[
              {
                key: "at",
                title: "Thời gian",
                render: (m) => (
                  <div className="min-w-32">
                    <strong>{date(m.at)}</strong>
                    <p className="muted text-sm">{m.at.slice(11, 16)}</p>
                  </div>
                ),
              },
              { key: "location", title: "Địa điểm", render: (m) => m.location },
              {
                key: "content",
                title: "Nội dung trao đổi",
                render: (m) => (
                  <p className="max-w-md line-clamp-3">{m.content}</p>
                ),
              },
              {
                key: "conclusion",
                title: "Kết luận",
                render: (m) => (
                  <p className="max-w-md line-clamp-3">{m.conclusion}</p>
                ),
              },
              {
                key: "action",
                title: "Thao tác",
                render: (m) => (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setDetailId(m.id)}
                    >
                      <Eye size={16} aria-hidden="true" />
                      Chi tiết
                    </Button>
                    {canEdit && (
                      <Button variant="ghost" onClick={() => setEditor(m)}>
                        <Pencil size={16} aria-hidden="true" />
                        Sửa
                      </Button>
                    )}
                    {advisor && !locked && (
                      <Button variant="ghost" onClick={() => setDeleteId(m.id)}>
                        <Trash2 size={16} aria-hidden="true" />
                        Xóa
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      )}
      {editor && (
        <MeetingEditor
          context={context}
          meeting={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
      {detail && (
        <Modal
          wide
          title="Biên bản buổi hướng dẫn"
          onClose={() => setDetailId("")}
        >
          <div className="space-y-5">
            <Notice>
              <CalendarDays size={16} className="inline mr-2" />
              {date(detail.at)} · {detail.at.slice(11, 16)} · {detail.location}
            </Notice>
            <div>
              <h3 className="font-semibold mb-2">Nội dung trao đổi</h3>
              <p className="whitespace-pre-wrap">{detail.content}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Kết luận và việc cần làm</h3>
              <p className="whitespace-pre-wrap">{detail.conclusion}</p>
            </div>
          </div>
        </Modal>
      )}
      {deleteId && (
        <Confirm
          title="Xóa nhật ký buổi hướng dẫn?"
          description="Bản ghi trao đổi này sẽ được gỡ khỏi hồ sơ. Hoạt động xóa vẫn được lưu trong nhật ký hệ thống."
          pending={action.pending}
          onClose={() => setDeleteId("")}
          onConfirm={() =>
            action
              .run(() => guidanceService.deleteMeeting(deleteId))
              .then(() => setDeleteId(""))
              .catch(() => {})
          }
        />
      )}
    </>
  );
}
export default function MeetingLogPage() {
  return <DataBoundary>{(db) => <MeetingsContent db={db} />}</DataBoundary>;
}
