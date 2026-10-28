import { createContext, useContext, useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type {
  CommitteePlan,
  ReviewerPlan,
  ScheduleSlot,
  PlanningContext,
} from "@doan/shared";
import { getAccessToken, getApiUser } from "../../../shared/api/api-session";
import {
  Button,
  Card,
  Empty,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import { defensePlanningMode, planningApi, planningErrorMessage } from "./api";
import { OfficialStagePanel } from "../workflow/panels";

export type LocalPlan = {
  expectedContext: string;
  committees: CommitteePlan[];
  reviewers: ReviewerPlan[];
  slots: ScheduleSlot[];
  includeReviewersAsAttendees: boolean;
};
type Workspace = {
  termId: string;
  context: PlanningContext;
  plan: LocalPlan;
  setPlan: (value: LocalPlan) => void;
  blocked: boolean;
  conflict: () => Promise<void>;
};
const PlanningWorkspace = createContext<Workspace | null>(null);
export function usePlanning() {
  const value = useContext(PlanningWorkspace);
  if (!value) throw new Error("Chưa có context/phương án preview hợp lệ.");
  return value;
}
export function PlanningSource({ context }: { context: PlanningContext }) {
  return (
    <>
      <Notice>
        {context.source.kind === "UC18_FINALIZED"
          ? "Nguồn: bản chốt UC18 đã xác minh. Preview vẫn chưa phải quyết định phân công/lịch chính thức."
          : "UC18 chưa FINALIZED. Các hồ sơ dưới đây chỉ là roster để mô phỏng, không phải danh sách được phép bảo vệ."}
      </Notice>
      <p>
        UC18: {context.uc18.state} · {context.source.rosterCount} sinh viên
        trong nguồn · Được UC18 cho phép:{" "}
        {context.source.admittedCount ?? "Chưa xác định"}
      </p>
      {context.blockers.map((b) => (
        <Notice key={b.code}>{b.message}</Notice>
      ))}
      <details>
        <summary>Danh sách hồ sơ và nguồn GVHD</summary>
        <div className="space-y-2 mt-3">
          {context.students.map((s) => (
            <p key={s.termStudentId}>
              {s.code || s.studentId} · {s.name || "Thiếu dữ liệu hiện hành"} ·{" "}
              {s.proposalId ? s.title || s.proposalId : "Chưa có Proposal"} ·
              GVHD: {s.advisor?.name || "Chưa xác minh chính thức"} ·{" "}
              {s.admitted === null
                ? "Chưa xét chính thức"
                : s.admitted
                  ? "Trong tập được UC18 cho phép"
                  : "Không thuộc tập được bảo vệ"}{" "}
              · Bằng chứng: {s.evidence}
            </p>
          ))}
        </div>
      </details>
    </>
  );
}
export default function DefensePlanningLayout() {
  const location = useLocation(),
    user = getApiUser();
  if (defensePlanningMode() !== "API")
    return (
      <Notice tone="danger">
        UC19–21 API thật yêu cầu VITE_DEFENSE_PLANNING_API=true và
        VITE_AUTH_API=true. Không thay bằng demo.
      </Notice>
    );
  if (!user || !getAccessToken())
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.mustChangePassword)
    return <Navigate to="/change-password" replace />;
  return (
    <PlanningContent
      key={`${user.id}:${getAccessToken()}`}
      sessionKey={`${user.id}:${getAccessToken()}`}
    />
  );
}
function PlanningContent({ sessionKey }: { sessionKey: string }) {
  const [termId, setTermId] = useState("");
  const terms = useQuery({
    queryKey: ["defense-planning-terms", sessionKey],
    queryFn: planningApi.terms,
    retry: false,
  });
  const selected = termId || terms.data?.items[0]?.id || "";
  return (
    <section className="max-w-7xl mx-auto space-y-5">
      <Link to="/">← Về không gian làm việc</Link>
      <PageHeader
        title="Hội đồng · Phản biện · Lịch bảo vệ"
        description="Dữ liệu từ backend thật. Dùng Lưu draft để ghi server; preview và chỉnh sửa local chưa phải bản đã chốt/công bố."
      />
      <nav className="flex gap-5">
        <Link to="/defense/committees">UC19 · Hội đồng</Link>
        <Link to="/defense/reviewers">UC20 · Phản biện</Link>
        <Link to="/defense/schedule">UC21 · Lịch</Link>
      </nav>
      <Card title="Đợt được phép lập phương án">
        {terms.isPending && <p role="status">Đang tải phạm vi…</p>}
        {terms.error && (
          <>
            <Notice tone="danger">{planningErrorMessage(terms.error)}</Notice>
            <Button
              variant="secondary"
              onClick={() => {
                void terms.refetch();
              }}
            >
              Thử tải lại danh sách đợt
            </Button>
          </>
        )}
        {terms.data && !terms.data.items.length && (
          <Empty
            title="Chưa có đợt thuộc grant toàn đợt"
            description="Cần permission defense-planning:read và AcademicTermGrant allDepartments=true đúng đợt."
          />
        )}
        <select
          aria-label="Đợt lập phương án"
          value={selected}
          onChange={(e) => setTermId(e.target.value)}
        >
          {terms.data?.items.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Card>
      {selected && (
        <TermWorkspace
          key={selected}
          termId={selected}
          sessionKey={sessionKey}
        />
      )}
    </section>
  );
}
function TermWorkspace({
  termId,
  sessionKey,
}: {
  termId: string;
  sessionKey: string;
}) {
  const location = useLocation();
  const stage = location.pathname.endsWith("reviewers")
    ? "REVIEWERS"
    : location.pathname.endsWith("schedule")
      ? "SCHEDULE"
      : "COMMITTEES";
  const context = useQuery({
    queryKey: ["defense-planning-context", sessionKey, termId],
    queryFn: () => planningApi.context(termId),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [plan, setPlan] = useState<LocalPlan | null>(null);
  const [stale, setStale] = useState(false);
  const blocked =
    !plan ||
    stale ||
    context.isError ||
    context.isFetching ||
    !context.data?.capabilities.canPreview ||
    plan.expectedContext !== context.data?.expectedContext;
  const conflict = async () => {
    setStale(true);
    await context.refetch();
  };
  return (
    <>
      {context.isPending && (
        <p role="status">Đang tải dữ liệu đợt từ backend…</p>
      )}
      {context.error && (
        <>
          <Notice tone="danger">{planningErrorMessage(context.error)}</Notice>
          <Button
            variant="secondary"
            onClick={() => {
              setStale(true);
              void context.refetch();
            }}
          >
            Thử tải lại nguồn
          </Button>
        </>
      )}
      {context.data && !context.isError && (
        <>
          <Card title="Nguồn dữ liệu và điều kiện nghiệp vụ">
            <PlanningSource context={context.data} />
            <div className="flex gap-3 mt-4">
              <Button
                variant="secondary"
                disabled={context.isFetching}
                onClick={() => {
                  setStale(true);
                  void context.refetch();
                }}
              >
                Tải lại nguồn
              </Button>
              <Button
                disabled={
                  !context.data.capabilities.canPreview || context.isFetching
                }
                onClick={() => {
                  setPlan({
                    expectedContext: context.data.expectedContext,
                    committees: [],
                    reviewers: [],
                    slots: [],
                    includeReviewersAsAttendees: false,
                  });
                  setStale(false);
                }}
              >
                {plan
                  ? "Bỏ phương án cũ và khởi tạo lại"
                  : "Khởi tạo phương án chưa lưu"}
              </Button>
            </div>
            {plan && blocked && (
              <Notice tone="danger">
                Nguồn đã đổi/đang tải hoặc không đủ quyền. Cần tải lại và khởi
                tạo lại phương án; không tự chuyển các đề xuất sang nguồn mới.
              </Notice>
            )}
            {!context.data.capabilities.canPreview && (
              <Notice>
                Chỉ có quyền đọc. Cần defense-planning:preview để kiểm tra
                phương án.
              </Notice>
            )}
          </Card>
          {!plan && (
            <Empty
              title="Chưa khởi tạo phương án"
              description="Vẫn có thể xem các bản ghi cũ bên dưới. Cần quyền preview và khởi tạo để nhập phương án chưa lưu."
            />
          )}
          <PlanningWorkspace.Provider
            value={{
              termId,
              context: context.data,
              plan: plan || {
                expectedContext: context.data.expectedContext,
                committees: [],
                reviewers: [],
                slots: [],
                includeReviewersAsAttendees: false,
              },
              setPlan: (value) => {
                if (!blocked) setPlan(value);
              },
              blocked,
              conflict,
            }}
          >
            <OfficialStagePanel
              termId={termId}
              stage={stage}
              plan={plan}
              onLoad={(saved) => {
                const c = saved.stages.find(
                  (s) => s.stage === "COMMITTEES",
                )?.draft;
                const r = saved.stages.find(
                  (s) => s.stage === "REVIEWERS",
                )?.draft;
                const s = saved.stages.find(
                  (s) => s.stage === "SCHEDULE",
                )?.draft;
                setPlan({
                  expectedContext: context.data.expectedContext,
                  committees: c && "committees" in c ? c.committees : [],
                  reviewers: r && "reviewers" in r ? r.reviewers : [],
                  slots: s && "slots" in s ? s.slots : [],
                  includeReviewersAsAttendees: true,
                });
                setStale(false);
              }}
            />
            <Outlet />
          </PlanningWorkspace.Provider>
        </>
      )}
    </>
  );
}
