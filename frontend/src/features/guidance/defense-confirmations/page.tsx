import { useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { getAccessToken, getApiUser } from "../../../shared/api/api-session";
import {
  Button,
  Card,
  Empty,
  Field,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import { defenseConfirmationApi as api, saveReportBlob } from "./api";
import {
  confirmationErrorMessage,
  downloadReport,
  recordDecision,
} from "./actions";
import { defenseConfirmationMode } from "./config";
import { DefenseConfirmationInbox } from "./inbox";
import { contextReviewKey, type DecisionForm } from "./validation";
import {
  ConfirmationContextView,
  ConfirmationDecisionForm,
  ConfirmationHistory,
  CurrentDecisionView,
} from "./components";

export default function DefenseConfirmationApiPage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const proposalId = params.get("proposalId")?.trim() || "";
  const [input, setInput] = useState(proposalId);
  const user = getApiUser();
  if (defenseConfirmationMode() !== "API")
    return (
      <main className="p-6">
        <Notice tone="danger">
          Chế độ UC17 API thật yêu cầu cả VITE_DEFENSE_CONFIRMATION_API=true và
          VITE_AUTH_API=true. Không dùng dữ liệu demo để thay thế.
        </Notice>
      </main>
    );
  if (!user || !getAccessToken())
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  if (user.mustChangePassword)
    return <Navigate to="/change-password" replace />;
  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <Link className="text-indigo-600" to="/">
        ← Về không gian làm việc
      </Link>
      <PageHeader
        eyebrow="HƯỚNG DẪN ĐỒ ÁN / UC17"
        title="Xác nhận bảo vệ UC17"
        description="Dữ liệu từ backend thật. Chỉ GVHD chính thức có quyền phù hợp được ghi quyết định."
      />
      <DefenseConfirmationInbox
        sessionKey={`${user.id}:${getAccessToken()}`}
        roles={user.roles}
      />
      <Card title="Mở chi tiết hồ sơ">
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ proposalId: input.trim() });
          }}
        >
          <Field label="Mã hồ sơ Proposal">
            <input
              value={input}
              required
              maxLength={36}
              onChange={(e) => setInput(e.target.value)}
            />
          </Field>
          <Button>Mở hồ sơ</Button>
        </form>
        <p className="muted text-sm mt-3">
          Chọn hồ sơ từ danh sách hoặc dùng liên kết ?proposalId=…; backend kiểm
          tra quyền cho từng hồ sơ.
        </p>
      </Card>
      {proposalId ? (
        <DefenseConfirmationDetail
          key={`${user.id}:${getAccessToken()}:${proposalId}`}
          proposalId={proposalId}
          sessionKey={`${user.id}:${getAccessToken()}`}
        />
      ) : (
        <Empty
          title="Chọn hồ sơ thực để xem UC17"
          description="Cần proposalId thuộc phạm vi GVHD hiện hành. Trang không tự tạo hồ sơ hoặc dữ liệu mẫu."
        />
      )}
    </main>
  );
}

function DefenseConfirmationDetail({
  proposalId,
  sessionKey,
}: {
  proposalId: string;
  sessionKey: string;
}) {
  const queryClient = useQueryClient();
  const scope = ["defense-confirmation", sessionKey, proposalId];
  const options = {
    retry: false as const,
    staleTime: 0,
    refetchOnWindowFocus: false,
  };
  const decision = useQuery({
    queryKey: [...scope, "decision"],
    queryFn: () => api.decision(proposalId),
    ...options,
  });
  const isAdvisor = !decision.isError && decision.data?.viewer === "ADVISOR";
  const canReadHistory =
    !decision.isError && !!decision.data && decision.data.viewer !== "STUDENT";
  const context = useQuery({
    queryKey: [...scope, "context"],
    queryFn: () => api.context(proposalId),
    enabled: isAdvisor,
    ...options,
  });
  const history = useInfiniteQuery({
    queryKey: [...scope, "history"],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => api.history(proposalId, pageParam),
    getNextPageParam: (last) =>
      last.hasMore ? (last.nextAfterRevision ?? undefined) : undefined,
    enabled: canReadHistory,
    ...options,
  });
  const [epoch, setEpoch] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [notice, setNotice] = useState("");
  const invalidateReview = () => {
    setEpoch((n) => n + 1);
    setBlocked(true);
    setNotice(
      "Dữ liệu đã được làm mới hoặc thay đổi. Hãy xem lại hồ sơ/PDF và xác nhận lại trước khi gửi quyết định.",
    );
  };
  const reload = async () => {
    setBlocked(true);
    const results = await Promise.allSettled([
      ...(isAdvisor ? [context.refetch({ throwOnError: true })] : []),
      decision.refetch({ throwOnError: true }),
      ...(canReadHistory ? [history.refetch({ throwOnError: true })] : []),
    ]);
    const failed = results.find((r) => r.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    setBlocked(false);
  };
  const lifecycle = { invalidateReview, reload };
  const write = useMutation({
    retry: false,
    mutationFn: (form: DecisionForm) => {
      if (
        !isAdvisor ||
        !context.data ||
        blocked ||
        context.isFetching ||
        context.isError ||
        decision.isError ||
        history.isError
      )
        throw new Error(
          "Hãy tải lại và xem context hợp lệ trước khi gửi quyết định.",
        );
      return recordDecision(context.data, form, lifecycle);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: ["uc17-inbox", sessionKey],
      });
      setNotice(
        result.changed
          ? "Đã lưu quyết định; context, quyết định và lịch sử đã được tải lại từ backend."
          : "Backend xác nhận quyết định không thay đổi; dữ liệu đã được tải lại.",
      );
    },
  });
  const download = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!context.data || blocked || context.isFetching || context.isError)
        throw new Error("Hãy tải lại context trước khi tải PDF.");
      const blob = await downloadReport(context.data, lifecycle);
      saveReportBlob(
        blob,
        context.data.pdf.snapshot?.originalName || "final-report.pdf",
      );
      // No review acknowledgement or decision mutation after downloading.
    },
  });
  const busy =
    write.isPending ||
    download.isPending ||
    context.isFetching ||
    decision.isFetching ||
    history.isFetching;
  const errors = [
    context.error,
    decision.error,
    history.error,
    write.error,
    download.error,
  ].filter(Boolean);
  const ready =
    !blocked &&
    !context.isError &&
    !decision.isError &&
    !history.isError &&
    !!decision.data &&
    !!history.data;
  return (
    <div className="space-y-6">
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => {
          invalidateReview();
          write.reset();
          download.reset();
          void reload().catch(() => undefined);
        }}
      >
        Tải lại hồ sơ
      </Button>
      {notice && <Notice>{notice}</Notice>}
      {errors.map((error, i) => (
        <Notice tone="danger" key={i}>
          {confirmationErrorMessage(error)}
        </Notice>
      ))}
      {(decision.isPending ||
        (isAdvisor && context.isPending) ||
        (canReadHistory && history.isPending)) && (
        <p role="status">Đang tải dữ liệu UC17…</p>
      )}
      {isAdvisor && context.data && !context.isError && (
        <ConfirmationContextView
          context={context.data}
          downloading={busy || blocked}
          onDownload={() => download.mutate()}
        />
      )}
      {decision.data && !decision.isError && (
        <CurrentDecisionView response={decision.data} />
      )}
      {decision.data && !isAdvisor && (
        <Notice>
          Chế độ chỉ đọc theo phạm vi {decision.data.viewer}. Context nội bộ,
          PDF và thao tác quyết định dành cho GVHD chính thức.
        </Notice>
      )}
      {isAdvisor && context.data && (
        <ConfirmationDecisionForm
          key={`${epoch}:${contextReviewKey(context.data)}`}
          context={context.data}
          busy={busy || !ready}
          onSubmit={(form) => {
            write.reset();
            download.reset();
            write.mutate(form);
          }}
        />
      )}
      {canReadHistory && history.data && !history.isError && (
        <ConfirmationHistory
          items={history.data.pages.flatMap((p) => p.items)}
          state={history.data.pages[0].historyState}
          hasMore={history.hasNextPage}
          busy={busy}
          onMore={() => {
            void history.fetchNextPage();
          }}
        />
      )}
    </div>
  );
}
