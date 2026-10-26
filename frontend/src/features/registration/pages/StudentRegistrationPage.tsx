import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  registrationApi,
  REGISTRATION_API,
} from "../services/registration-api";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
  Save,
  Send,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Confirm,
  Field,
  Notice,
  PageHeader,
  Person,
  date,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import {
  registrationService,
  registrationWindow,
} from "../services/registration-service";
export default function StudentRegistrationPage() {
  const { termId, user } = useWorkspace();
  return <RegistrationForm key={`${user.id}:${termId}`} />;
}
function RegistrationForm() {
  const { db, user, term, termId } = useWorkspace();
  const student = db.students.find((s) => s.id === user.studentId);
  const existing = db.registrations.find(
    (r) => r.termId === termId && r.studentId === user.studentId,
  );
  const [email, setEmail] = useState(user.email || student?.email || "");
  const [phone, setPhone] = useState(user.phone || student?.phone || "");
  useEffect(() => {
    setEmail(user.email || "");
    setPhone(user.phone || "");
  }, [user.email, user.phone]);
  const [direction, setDirection] = useState(existing?.directionId || "");
  const [prefs, setPrefs] = useState<string[]>(existing?.preferences || []);
  const [note, setNote] = useState(existing?.note || "");
  const [confirm, setConfirm] = useState(false);
  const [success, setSuccess] = useState("");
  const action = useAction();
  const context = useQuery({
    queryKey: ["registration", user.id, termId],
    queryFn: () => registrationApi.current(termId),
    enabled: REGISTRATION_API && !!termId,
    retry: false,
    refetchInterval: 15000,
  });
  const [serverElapsed, setServerElapsed] = useState(0);
  useEffect(() => {
    setServerElapsed(0);
    const started = performance.now();
    const timer = setInterval(
      () => setServerElapsed(performance.now() - started),
      1000,
    );
    return () => clearInterval(timer);
  }, [context.dataUpdatedAt]);
  const savedRow = context.data?.registration;
  useEffect(() => {
    if (!REGISTRATION_API || !context.data) return;
    setDirection(savedRow?.directionId || "");
    setPrefs(savedRow?.preferences.map((p) => p.lecturerId) || []);
    setNote(savedRow?.note || "");
  }, [savedRow?.id, savedRow?.updatedAt]);
  const serverWindow = context.data?.window;
  const serverClosed =
    !!serverWindow?.endAt &&
    Date.parse(serverWindow.serverNow) + serverElapsed >=
      Date.parse(serverWindow.endAt);
  const reason =
    (REGISTRATION_API
      ? context.isPending
        ? "Đang tải đăng ký từ máy chủ…"
        : context.isError
          ? context.error.message
          : serverClosed
            ? "Đã hết hạn đăng ký."
            : serverWindow?.canWrite
              ? ""
              : serverWindow?.reason || "Chưa thể đăng ký."
      : registrationWindow(db, termId)) ||
    (!term.studentIds.includes(student?.id || "")
      ? "Bạn chưa thuộc danh sách sinh viên đủ điều kiện của đợt này."
      : "");
  const lecturers = db.lecturers.filter(
    (l) =>
      term.lecturers.some((t) => t.lecturerId === l.id) &&
      l.isActive !== false &&
      (!REGISTRATION_API || context.data?.lecturerIds.includes(l.id)) &&
      l.directionIds.includes(direction),
  );
  async function save(submit: boolean) {
    setSuccess("");
    try {
      await action.run(() =>
        registrationService.save(
          termId,
          { directionId: direction, preferences: prefs, note },
          submit,
          email,
          phone,
        ),
      );
      setConfirm(false);
      setSuccess(
        submit
          ? "Đăng ký đã được ghi nhận. Bạn có thể sửa trước khi hết hạn hoặc bị khóa."
          : "Đã lưu bản nháp đăng ký.",
      );
    } catch {
      setConfirm(false);
    }
  }
  function move(index: number, offset: number) {
    const next = [...prefs];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setPrefs(next);
  }
  return (
    <>
      <PageHeader
        eyebrow="BƯỚC 02 · ĐĂNG KÝ NGUYỆN VỌNG"
        title="Đăng ký hướng đồ án & GVHD"
        description="Chọn một hướng phù hợp và sắp xếp tối đa 3 giảng viên theo thứ tự ưu tiên."
        actions={existing && <Badge value={existing.status} />}
      />
      <div className="mb-6">
        <Notice tone={reason ? "warning" : "info"}>
          <b>
            {term.name} · {term.program}
          </b>
          <br />
          Thời gian đăng ký: {date(term.registrationStart)} →{" "}
          {date(term.registrationEnd)}.{" "}
          {reason ||
            "Cổng đăng ký đang mở. Quota không được giữ chỗ khi đăng ký."}
        </Notice>
      </div>
      {success && (
        <div className="mb-5">
          <Notice tone="success">{success}</Notice>
        </div>
      )}
      {action.error && <Notice tone="danger">{action.error.message}</Notice>}
      {context.isError && (
        <Button variant="secondary" onClick={() => context.refetch()}>
          Tải lại đăng ký
        </Button>
      )}
      {savedRow?.legacyStatus && (
        <Notice tone="warning">
          Đăng ký cũ chưa có hướng hoặc thời điểm nộp hợp lệ. Vui lòng chọn
          hướng và nộp lại trong thời gian mở.
        </Notice>
      )}
      <div className="section-grid">
        <div className="stack">
          <Card
            title="01. Thông tin liên hệ"
            description="Khoa và giảng viên sử dụng thông tin này để trao đổi về đồ án."
          >
            <div className="mb-5">
              <Person
                name={student?.name || user.name}
                sub={`${student?.code || ""} · ${student?.className || ""}`}
              />
            </div>
            <fieldset disabled={!!reason || action.pending}>
              <div className="form-grid">
                <Field label="Email liên hệ *">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field label="Số điện thoại *">
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
              </div>
            </fieldset>
          </Card>
          <Card title="02. Hướng đồ án">
            <fieldset disabled={!!reason || action.pending}>
              <Field label="Chọn duy nhất một hướng *">
                <select
                  value={direction}
                  onChange={(e) => {
                    setDirection(e.target.value);
                    setPrefs([]);
                  }}
                >
                  <option value="">Chọn hướng đồ án</option>
                  {db.catalogs
                    .filter(
                      (c) =>
                        c.kind === "direction" &&
                        c.active &&
                        (!REGISTRATION_API ||
                          context.data?.directions.some((d) => d.id === c.id)),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </Field>
              <p className="muted text-xs mt-3">
                Khi đổi hướng, danh sách nguyện vọng sẽ được chọn lại theo
                chuyên môn của giảng viên.
              </p>
            </fieldset>
          </Card>
          <Card
            title="03. Thứ tự nguyện vọng"
            description="Nguyện vọng 1 được xét trước. Dùng mũi tên để thay đổi thứ tự."
          >
            <fieldset disabled={!!reason || action.pending}>
              <div className="stack">
                {prefs.map((id, i) => {
                  const l = db.lecturers.find((l) => l.id === id);
                  return (
                    <div className="preference-row" key={id}>
                      <span className="preference-number">NV{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <Person
                          name={l?.name || "Giảng viên không còn tham gia"}
                          sub={l?.email}
                        />
                      </div>
                      <div className="flex">
                        <button
                          className="icon-btn"
                          aria-label={`Nâng NV${i + 1}`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          className="icon-btn"
                          aria-label={`Hạ NV${i + 1}`}
                          disabled={i === prefs.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          className="icon-btn"
                          aria-label={`Xóa NV${i + 1}`}
                          onClick={() =>
                            setPrefs(prefs.filter((x) => x !== id))
                          }
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {prefs.length <
                  Math.min(3, term.parameters.max_preferences) && (
                  <Field label={`Thêm nguyện vọng ${prefs.length + 1}`}>
                    <select
                      value=""
                      disabled={!direction}
                      onChange={(e) => {
                        if (e.target.value)
                          setPrefs([...prefs, e.target.value]);
                      }}
                    >
                      <option value="">
                        {direction
                          ? "Chọn giảng viên tham gia đợt"
                          : "Chọn hướng đồ án trước"}
                      </option>
                      {lecturers
                        .filter((l) => !prefs.includes(l.id))
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} · quota{" "}
                            {
                              term.lecturers.find((t) => t.lecturerId === l.id)
                                ?.quota
                            }
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
                {direction && !lecturers.length && (
                  <Notice tone="warning">
                    Chưa có giảng viên cùng hướng tham gia đợt này. Liên hệ Giáo
                    vụ Khoa.
                  </Notice>
                )}
                <Field label="Ghi chú / Kinh nghiệm đã làm việc cùng GV">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Thông tin bổ sung để Khoa tham khảo khi phân công"
                  />
                </Field>
              </div>
            </fieldset>
            <div className="form-actions">
              <Button
                variant="secondary"
                disabled={!!reason || action.pending}
                onClick={() => save(false)}
              >
                <Save size={15} />
                Lưu nháp
              </Button>
              <Button
                disabled={!!reason || action.pending}
                onClick={() => setConfirm(true)}
              >
                <Send size={15} />
                Nộp đăng ký
              </Button>
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card title="Nguyên tắc đăng ký">
            <div className="space-y-5 text-xs leading-7 muted">
              <p className="flex gap-2">
                <CheckCircle2 size={17} className="shrink-0 mt-1" />
                Một sinh viên thực hiện một đề tài trong mỗi đợt.
              </p>
              <p className="flex gap-2">
                <CheckCircle2 size={17} className="shrink-0 mt-1" />
                Tối đa 3 GV khác nhau, cùng hướng chuyên môn.
              </p>
              <p className="flex gap-2">
                <Clock3 size={17} className="shrink-0 mt-1" />
                Có thể chỉnh sửa khi cổng còn mở. Sau công bố, xem kết quả tại
                Kết quả phân công.
              </p>
            </div>
          </Card>
          {existing && (
            <Card title="Đăng ký đã lưu">
              <dl className="info-grid">
                <div>
                  <dt>Hướng đồ án</dt>
                  <dd>
                    {
                      db.catalogs.find((c) => c.id === existing.directionId)
                        ?.name
                    }
                  </dd>
                </div>
                <div>
                  <dt>Cập nhật</dt>
                  <dd>{date(existing.updatedAt)}</dd>
                </div>
                {existing.submittedAt && (
                  <div>
                    <dt>Nộp hợp lệ</dt>
                    <dd>{date(existing.submittedAt)}</dd>
                  </div>
                )}
                <div className="col-span-2">
                  <dt>Thứ tự ưu tiên</dt>
                  <dd>
                    {existing.preferences.map((id, i) => (
                      <div key={id}>
                        NV{i + 1}: {db.lecturers.find((l) => l.id === id)?.name}
                      </div>
                    ))}
                  </dd>
                </div>
              </dl>
            </Card>
          )}
        </div>
      </div>
      {confirm && (
        <Confirm
          title="Nộp đăng ký nguyện vọng?"
          description="Kiểm tra Email, SĐT, hướng đồ án và thứ tự ưu tiên. Bạn được sửa đăng ký trong thời gian cổng còn mở."
          onClose={() => setConfirm(false)}
          onConfirm={() => save(true)}
          pending={action.pending}
        />
      )}
    </>
  );
}
