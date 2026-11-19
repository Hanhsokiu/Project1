import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  registrationApi,
  REGISTRATION_API,
} from "../services/registration-api";
import {
  RotateCcw,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Save,
  Send,
  X,
  CalendarDays,
  Layers,
  FileText,
  ChevronDown,
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
import "./student-registration.css";
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
  const preferencesRef = useRef<HTMLDivElement>(null);
  const previousPositions = useRef(new Map<string, number>());
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopMotion = () => {
      if (media.matches)
        preferencesRef.current
          ?.querySelectorAll<HTMLElement>(".preference-row")
          .forEach((row) =>
            row.getAnimations().forEach((animation) => animation.cancel()),
          );
    };
    media.addEventListener("change", stopMotion);
    return () => media.removeEventListener("change", stopMotion);
  }, []);
  useLayoutEffect(() => {
    const positions = previousPositions.current;
    previousPositions.current = new Map();
    const rows =
      preferencesRef.current?.querySelectorAll<HTMLElement>(".preference-row");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      rows?.forEach((row) =>
        row.getAnimations().forEach((animation) => animation.cancel()),
      );
      return;
    }
    if (!positions.size) return;
    const tokens = getComputedStyle(document.documentElement);
    rows?.forEach((row) => {
      const previous = positions.get(row.id);
      if (previous === undefined) return;
      row.getAnimations().forEach((animation) => animation.cancel());
      const offset = previous - row.getBoundingClientRect().top;
      if (Math.abs(offset) > 1)
        row.animate(
          [
            { transform: `translateY(${offset}px)` },
            { transform: "translateY(0)" },
          ],
          {
            duration:
              parseFloat(tokens.getPropertyValue("--utc-motion-reorder")) ||
              240,
            easing: tokens.getPropertyValue("--utc-ease").trim() || "ease-out",
          },
        );
    });
  }, [prefs]);
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
    previousPositions.current = new Map(
      Array.from(
        preferencesRef.current?.querySelectorAll<HTMLElement>(
          ".preference-row",
        ) || [],
      ).map((row) => [row.id, row.getBoundingClientRect().top]),
    );
    const next = [...prefs];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setPrefs(next);
    requestAnimationFrame(() => {
      document
        .getElementById(`registration-preference-${next[index + offset]}`)
        ?.focus({ preventScroll: true });
    });
  }
  return (
    <div className="registration-pilot">
      <div className="registration-hero">
        <PageHeader
          title="Đăng ký hướng đồ án & GVHD"
          description="Chọn một hướng phù hợp và sắp xếp tối đa 3 giảng viên theo thứ tự ưu tiên."
        />
      </div>
      <section
        className="registration-period"
        aria-label="Đợt và thời gian đăng ký"
      >
        <div className="registration-period-item">
          <div>
            <span className="registration-label">Đợt đăng ký</span>
            <p className="registration-term-name">{term.name}</p>
            <p className="registration-meta">{term.program}</p>
          </div>
        </div>
        <div className="registration-period-item registration-dates">
          <div>
            <span className="registration-label">Thời gian đăng ký</span>
            <p>
              {date(term.registrationStart)} <span>đến</span>{" "}
              {date(term.registrationEnd)}
            </p>
          </div>
        </div>
        <div className="registration-period-item registration-status">
          <div>
            <span className="registration-label">Trạng thái đã lưu</span>
            <div>
              {existing ? (
                <Badge value={existing.status} />
              ) : (
                <span className="registration-meta">Chưa có đăng ký</span>
              )}
            </div>
          </div>
        </div>
      </section>
      <div className="registration-feedback">
        <Notice tone={reason ? "warning" : "info"}>
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
          <RotateCcw size={16} aria-hidden="true" />
          Tải lại đăng ký
        </Button>
      )}
      {savedRow?.legacyStatus && (
        <Notice tone="warning">
          Đăng ký cũ chưa có hướng hoặc thời điểm nộp hợp lệ. Vui lòng chọn
          hướng và nộp lại trong thời gian mở.
        </Notice>
      )}
      <div className="registration-layout">
        <div className="registration-sections">
          <RegistrationSection
            revealError={!!action.error}
            collapseOnMobile={!!(email && phone)}
            title="Thông tin liên hệ"
            description="Khoa và giảng viên sử dụng thông tin này để trao đổi về đồ án. Các trường có * là bắt buộc."
          >
            <div className="registration-student">
              <Person
                name={student?.name || user.name}
                sub={`${student?.code || ""} · ${student?.className || ""}`}
              />
            </div>
            <fieldset
              aria-label="Thông tin liên hệ"
              disabled={!!reason || action.pending}
            >
              <div className="form-grid">
                <Field label="Email liên hệ *">
                  <span className="registration-control">
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </span>
                </Field>
                <Field label="Số điện thoại *">
                  <span className="registration-control">
                    <input
                      type="tel"
                      autoComplete="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </span>
                </Field>
              </div>
            </fieldset>
          </RegistrationSection>
          <RegistrationSection
            title="Hướng đồ án"
            revealError={!!action.error}
            collapseOnMobile={!!direction}
          >
            <fieldset
              aria-label="Hướng đồ án"
              className="registration-direction"
              disabled={!!reason || action.pending}
            >
              <Field label="Chọn duy nhất một hướng *">
                <select
                  aria-describedby="registration-selected-direction registration-direction-hint"
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
              <p
                id="registration-selected-direction"
                className="registration-selected-direction"
              >
                {direction && (
                  <>
                    Hướng đã chọn:{" "}
                    <strong>
                      {db.catalogs.find((c) => c.id === direction)?.name}
                    </strong>
                  </>
                )}
              </p>
              <p id="registration-direction-hint" className="registration-hint">
                Khi đổi hướng, danh sách nguyện vọng sẽ được chọn lại theo
                chuyên môn của giảng viên.
              </p>
            </fieldset>
          </RegistrationSection>
          <RegistrationSection
            revealError={!!action.error}
            title="Thứ tự nguyện vọng"
            description="Nguyện vọng 1 được xét trước. Dùng mũi tên để thay đổi thứ tự."
            action={
              <span
                className="registration-count"
                role="status"
                aria-label={`${prefs.length}/${Math.min(3, term.parameters.max_preferences)} nguyện vọng đã chọn`}
              >
                {prefs.length}/{Math.min(3, term.parameters.max_preferences)}
                <span className="registration-count-label"> đã chọn</span>
              </span>
            }
          >
            <fieldset
              aria-label="Thứ tự nguyện vọng"
              disabled={!!reason || action.pending}
            >
              <div
                className="stack registration-preferences"
                ref={preferencesRef}
              >
                {prefs.map((id, i) => {
                  const l = db.lecturers.find((l) => l.id === id);
                  return (
                    <div
                      className="preference-row"
                      key={id}
                      id={`registration-preference-${id}`}
                      role="group"
                      tabIndex={-1}
                      aria-label={`Nguyện vọng ${i + 1}: ${l?.name || "Giảng viên không còn tham gia"}`}
                    >
                      <span className="preference-number" aria-hidden="true">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <Person
                          name={l?.name || "Giảng viên không còn tham gia"}
                          sub={l?.email}
                        />
                      </div>
                      <div className="registration-preference-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Nâng NV${i + 1}`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                          title={`Nâng NV${i + 1}`}
                        >
                          <ArrowUp size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Hạ NV${i + 1}`}
                          disabled={i === prefs.length - 1}
                          onClick={() => move(i, 1)}
                          title={`Hạ NV${i + 1}`}
                        >
                          <ArrowDown size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-btn registration-remove"
                          aria-label={`Xóa NV${i + 1}`}
                          onClick={() =>
                            setPrefs(prefs.filter((x) => x !== id))
                          }
                          title={`Xóa NV${i + 1}`}
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {prefs.length <
                  Math.min(3, term.parameters.max_preferences) && (
                  <div className="registration-add-preference">
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
                            ? "Chọn giảng viên"
                            : "Chọn hướng đồ án trước"}
                        </option>
                        {lecturers
                          .filter((l) => !prefs.includes(l.id))
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name} · quota{" "}
                              {
                                term.lecturers.find(
                                  (t) => t.lecturerId === l.id,
                                )?.quota
                              }
                            </option>
                          ))}
                      </select>
                    </Field>
                  </div>
                )}
                {direction && !lecturers.length && (
                  <Notice tone="warning">
                    Chưa có giảng viên cùng hướng tham gia đợt này. Liên hệ Giáo
                    vụ Khoa.
                  </Notice>
                )}
                <RegistrationNote value={note}>
                  <Field label="Ghi chú / Kinh nghiệm đã làm việc cùng GV">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Thông tin bổ sung để Khoa tham khảo khi phân công"
                    />
                  </Field>
                </RegistrationNote>
              </div>
            </fieldset>
            <div className="form-actions">
              <p className="registration-save-hint">
                Lưu nháp chưa phải là nộp đăng ký.
              </p>
              <Button
                variant="secondary"
                disabled={!!reason || action.pending}
                onClick={() => save(false)}
                loading={action.pending}
              >
                <Save size={15} aria-hidden="true" />
                Lưu nháp
              </Button>
              <Button
                disabled={!!reason || action.pending}
                onClick={() => setConfirm(true)}
                loading={action.pending}
              >
                <Send size={15} aria-hidden="true" />
                Nộp đăng ký
              </Button>
            </div>
          </RegistrationSection>
        </div>
        <aside
          className="registration-aside"
          aria-label="Hồ sơ đã lưu và hướng dẫn"
        >
          {existing && (
            <Card className="registration-saved" title="Hồ sơ đăng ký">
              <dl className="info-grid">
                <div>
                  <dt>
                    <Layers size={17} aria-hidden="true" /> Hướng đồ án
                  </dt>
                  <dd>
                    {
                      db.catalogs.find((c) => c.id === existing.directionId)
                        ?.name
                    }
                  </dd>
                </div>
                <div>
                  <dt>
                    <CalendarDays size={17} aria-hidden="true" /> Cập nhật lần
                    cuối
                  </dt>
                  <dd>{date(existing.updatedAt)}</dd>
                </div>
                {existing.submittedAt && (
                  <div>
                    <dt>
                      <CheckCircle2 size={17} aria-hidden="true" /> Thời điểm
                      nộp hợp lệ
                    </dt>
                    <dd>{date(existing.submittedAt)}</dd>
                  </div>
                )}
                <div className="col-span-2">
                  <dt>
                    <FileText size={17} aria-hidden="true" /> Thứ tự ưu tiên
                  </dt>
                  <dd>
                    {existing.preferences.map((id, i) => (
                      <div key={id}>
                        <span className="registration-saved-rank">{i + 1}</span>{" "}
                        {db.lecturers.find((l) => l.id === id)?.name}
                      </div>
                    ))}
                  </dd>
                </div>
              </dl>
            </Card>
          )}
          <section
            className="registration-guidelines"
            aria-labelledby="registration-rules-title"
          >
            <h2 id="registration-rules-title">Nguyên tắc đăng ký</h2>
            <ul className="registration-rules">
              <li>
                <span>Một sinh viên thực hiện một đề tài trong mỗi đợt.</span>
              </li>
              <li>
                <span>Tối đa 3 GV khác nhau, cùng hướng chuyên môn.</span>
              </li>
              <li>
                <span>
                  Có thể chỉnh sửa khi cổng còn mở. Sau công bố, xem kết quả tại
                  Kết quả phân công.
                </span>
              </li>
            </ul>
          </section>
        </aside>
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
    </div>
  );
}

/** Optional text stays discoverable; an existing note is always expanded on load. */
function RegistrationNote({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(!!value);
  useEffect(() => {
    if (value) setExpanded(true);
  }, [value]);
  return (
    <details
      className="registration-note"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        Ghi chú thêm <span>(không bắt buộc)</span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      {children}
    </details>
  );
}

/** Mobile disclosure keeps the same mounted fields, values and service actions. */
function RegistrationSection({
  title,
  description,
  action,
  children,
  revealError,
  collapseOnMobile = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  revealError: boolean;
  collapseOnMobile?: boolean;
}) {
  const contentId = useId();
  // CSS keeps desktop sections open. Mobile starts compact only when values exist.
  const [expanded, setExpanded] = useState(!collapseOnMobile);
  useEffect(() => {
    if (revealError) setExpanded(true);
  }, [revealError]);
  return (
    <Card
      className={`registration-section ${expanded ? "" : "is-collapsed"}`}
      title={title}
      description={description}
      action={
        <div className="registration-section-controls">
          {action}
          <button
            type="button"
            className="registration-section-toggle"
            aria-expanded={expanded}
            aria-controls={contentId}
            aria-label={`${expanded ? "Thu gọn" : "Mở rộng"} ${title}`}
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        </div>
      }
    >
      <div id={contentId}>{children}</div>
    </Card>
  );
}
