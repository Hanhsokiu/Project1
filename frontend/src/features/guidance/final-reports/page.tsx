import { useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getAccessToken, getApiUser } from "../../../shared/api/api-session";
import {
  Button,
  Card,
  Empty,
  Field,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import { finalReportApi as api, saveFinalReportBlob } from "./api";
import { finalReportErrorMessage, uploadFinalReport } from "./actions";
import { finalReportMode } from "./config";
import { uploadContextKey } from "./validation";
import {
  CurrentFinalReportView,
  FinalReportContextView,
  FinalReportUploadForm,
} from "./components";

export default function FinalReportApiPage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const proposalId = params.get("proposalId")?.trim() || "";
  const [input, setInput] = useState(proposalId);
  const user = getApiUser();
  if (finalReportMode() !== "API")
    return (
      <main className="p-6">
        <Notice tone="danger">
          Chế độ PDF thật yêu cầu VITE_FINAL_REPORT_API=true và
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
  if (!user.roles.includes("STUDENT"))
    return (
      <main className="p-6 space-y-4">
        <Notice tone="danger">
          API nộp PDF này dành cho sinh viên của hồ sơ. GVHD sử dụng màn hình
          UC17 để tải PDF theo quyền được cấp.
        </Notice>
        <Link to="/guidance/defense-confirm">Mở UC17</Link>
      </main>
    );
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <Link className="text-indigo-600" to="/">
        ← Về không gian làm việc
      </Link>
      <PageHeader
        eyebrow="HƯỚNG DẪN ĐỒ ÁN / PDF CUỐI CÙNG"
        title="Nộp báo cáo PDF cuối cùng"
        description="Dữ liệu từ backend thật; chỉ sinh viên sở hữu hồ sơ được nộp hoặc tải PDF."
      />
      <Card title="Mở hồ sơ của bạn">
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setParams({ proposalId: input.trim() });
          }}
        >
          <Field label="Mã hồ sơ Proposal">
            <input
              value={input}
              required
              maxLength={100}
              onChange={(event) => setInput(event.target.value)}
            />
          </Field>
          <Button>Mở hồ sơ</Button>
        </form>
        <p className="muted text-sm mt-3">
          Dùng proposalId thực hoặc liên kết ?proposalId=…; backend kiểm tra
          quyền sở hữu. Trang không lấy hồ sơ từ danh sách demo.
        </p>
      </Card>
      {proposalId ? (
        <FinalReportDetail
          key={`${user.id}:${getAccessToken()}:${proposalId}`}
          proposalId={proposalId}
          sessionKey={`${user.id}:${getAccessToken()}`}
        />
      ) : (
        <Empty
          title="Chưa chọn hồ sơ thực"
          description="Nhập proposalId của bạn để đọc cửa sổ nộp và PDF hiện hành."
        />
      )}
    </main>
  );
}

function FinalReportDetail({
  proposalId,
  sessionKey,
}: {
  proposalId: string;
  sessionKey: string;
}) {
  const scope = ["final-report", sessionKey, proposalId];
  const options = {
    retry: false as const,
    staleTime: 0,
    refetchOnWindowFocus: false,
  };
  const context = useQuery({
    queryKey: [...scope, "context"],
    queryFn: () => api.context(proposalId),
    ...options,
  });
  const metadata = useQuery({
    queryKey: [...scope, "metadata"],
    queryFn: () => api.metadata(proposalId),
    ...options,
  });
  const [blocked, setBlocked] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState(0);
  const invalidate = () => {
    setBlocked(true);
    setEpoch((value) => value + 1);
    setProgress(0);
  };
  const reload = async () => {
    setBlocked(true);
    const results = await Promise.allSettled([
      context.refetch({ throwOnError: true }),
      metadata.refetch({ throwOnError: true }),
    ]);
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    setBlocked(false);
  };
  const upload = useMutation({
    retry: false,
    mutationFn: (file: File) => {
      if (
        !context.data ||
        !metadata.data ||
        blocked ||
        context.isFetching ||
        metadata.isFetching ||
        context.isError ||
        metadata.isError
      )
        throw new Error(
          "Hãy tải lại context và metadata hợp lệ trước khi nộp PDF.",
        );
      return uploadFinalReport(
        context.data,
        metadata.data,
        file,
        { invalidate, reload },
        setProgress,
      );
    },
    onSuccess: () => {
      setProgress(0);
      setNotice(
        "Đã nộp PDF thành công. Context và metadata hiện hành đã được tải lại từ backend; quyết định UC17 không tự thay đổi.",
      );
    },
    onError: () => {
      setProgress(0);
      setNotice("");
    },
  });
  const download = useMutation({
    retry: false,
    mutationFn: async () => {
      if (
        blocked ||
        metadata.isFetching ||
        metadata.isError ||
        metadata.data?.state !== "SUBMITTED"
      )
        throw new Error(
          "Hãy tải lại thông tin PDF hiện hành trước khi tải file.",
        );
      saveFinalReportBlob(await api.download(proposalId));
    },
  });
  const busy =
    context.isFetching ||
    metadata.isFetching ||
    upload.isPending ||
    download.isPending;
  const ready =
    !blocked &&
    !context.isError &&
    !metadata.isError &&
    !!context.data &&
    !!metadata.data;
  const errors = [
    context.error,
    metadata.error,
    upload.error,
    download.error,
  ].filter(Boolean);
  return (
    <div className="space-y-6">
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => {
          invalidate();
          upload.reset();
          download.reset();
          setNotice("");
          void reload().catch(() => undefined);
        }}
      >
        Tải lại dữ liệu PDF
      </Button>
      {blocked && (
        <Notice tone="warning">
          Cần tải lại dữ liệu thành công rồi chọn lại file trước khi nộp tiếp.
          Không tự động gửi lại PDF.
        </Notice>
      )}
      {notice && <Notice tone="success">{notice}</Notice>}
      {errors.map((error, index) => (
        <Notice tone="danger" key={index}>
          {finalReportErrorMessage(error)}
        </Notice>
      ))}
      {(context.isPending || metadata.isPending) && (
        <p role="status">Đang tải dữ liệu PDF…</p>
      )}
      {context.data && !context.isError && (
        <FinalReportContextView context={context.data} />
      )}
      {metadata.data && !metadata.isError && (
        <CurrentFinalReportView
          report={metadata.data}
          busy={busy || blocked}
          onDownload={() => download.mutate()}
        />
      )}
      {context.data && metadata.data && (
        <FinalReportUploadForm
          key={`${epoch}:${uploadContextKey(context.data)}`}
          context={context.data}
          metadata={metadata.data}
          busy={busy || !ready}
          progress={progress}
          onUpload={(file) => {
            upload.reset();
            download.reset();
            setNotice("");
            upload.mutate(file);
          }}
        />
      )}
    </div>
  );
}
