import React, { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { DossierStudentProfileSchema } from "@doan/shared";
import type { DossierStudentProfileInput, DossierView } from "@doan/shared";
import { dossierApi } from "./api";
import { getErrorMessage } from "../../shared/api/error-message";

export function DossierStudentProfile({
  dossier,
  onResult,
}: {
  dossier: DossierView;
  onResult: (value: DossierView) => void;
}) {
  const profile = dossier.studentProfile;
  const [className, setClassName] = useState(
      profile?.className ?? profile?.suggestedClassName ?? "",
    ),
    [majorName, setMajorName] = useState(
      profile?.majorName ?? profile?.suggestedMajorName ?? "",
    ),
    [confirmed, setConfirmed] = useState(false),
    [validation, setValidation] = useState(""),
    [success, setSuccess] = useState("");
  useEffect(() => {
    setClassName(profile?.className ?? profile?.suggestedClassName ?? "");
    setMajorName(profile?.majorName ?? profile?.suggestedMajorName ?? "");
    setConfirmed(false);
    setValidation("");
  }, [
    dossier.proposalId,
    profile?.revision,
    profile?.className,
    profile?.majorName,
    profile?.suggestedClassName,
    profile?.suggestedMajorName,
  ]);
  const mutation = useMutation({
    mutationFn: (input: DossierStudentProfileInput) =>
      dossierApi.updateStudentProfile(dossier.proposalId, input),
    onSuccess: (value) => {
      setConfirmed(false);
      setSuccess(
        "Đã xác nhận lớp/ngành phục vụ bản in. Kiểm tra nội dung xem trước và chốt phiên bản đã được duyệt khi đủ điều kiện.",
      );
      onResult(value);
    },
  });
  if (!profile) return null;
  const missing = dossier.readiness.includes("STUDENT_PROFILE_NOT_READY");
  return (
    <section
      className="rg-panel space-y-4 p-5"
      aria-label="Lớp/ngành phục vụ bản in"
    >
      <h2 className="font-semibold">Lớp/ngành phục vụ bản in</h2>
      {profile.canManage ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSuccess("");
            if (!confirmed) {
              setValidation(
                "Hãy xác nhận đã đối chiếu đúng lớp và ngành đào tạo.",
              );
              return;
            }
            const parsed = DossierStudentProfileSchema.safeParse({
              className,
              majorName,
              expectedRevision: profile.revision,
            });
            if (!parsed.success) {
              setValidation(
                parsed.error.issues.map((item) => item.message).join("; "),
              );
              return;
            }
            setValidation("");
            mutation.mutate(parsed.data);
          }}
        >
          <p className="text-sm text-slate-600">
            Khoa đối chiếu lớp và ngành đào tạo chính thức của sinh viên trước
            khi xác nhận. Thông tin này dùng cho bản in đề cương.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Lớp
              <input
                aria-label="Lớp phục vụ bản in"
                className="mt-2 w-full rounded border p-2"
                value={className}
                required
                maxLength={100}
                disabled={mutation.isPending}
                onChange={(event) => {
                  setClassName(event.target.value);
                  setConfirmed(false);
                  setSuccess("");
                }}
              />
            </label>
            <label className="text-sm">
              Ngành đào tạo
              <input
                aria-label="Ngành đào tạo phục vụ bản in"
                className="mt-2 w-full rounded border p-2"
                value={majorName}
                required
                maxLength={200}
                disabled={mutation.isPending}
                onChange={(event) => {
                  setMajorName(event.target.value);
                  setConfirmed(false);
                  setSuccess("");
                }}
              />
            </label>
          </div>
          {((!profile.className && profile.suggestedClassName) ||
            (!profile.majorName && profile.suggestedMajorName)) && (
            <p className="text-sm text-slate-500">
              Lớp/ngành được gợi ý từ hồ sơ sinh viên; cần đối chiếu trước khi
              xác nhận.
            </p>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              disabled={mutation.isPending}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Tôi đã đối chiếu và xác nhận đúng lớp, ngành đào tạo của sinh viên.
          </label>
          <button
            type="submit"
            className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
            disabled={
              mutation.isPending ||
              !confirmed ||
              !className.trim() ||
              !majorName.trim()
            }
          >
            {mutation.isPending
              ? "Đang xác nhận…"
              : "Xác nhận lớp/ngành cho bản in"}
          </button>
        </form>
      ) : (
        <div className="space-y-2 text-sm">
          <p>Lớp: {profile.className || "Chưa được xác nhận"}</p>
          <p>Ngành đào tạo: {profile.majorName || "Chưa được xác nhận"}</p>
          {missing && (
            <p role="status" className="text-amber-800">
              Đang chờ Khoa xác nhận lớp/ngành phục vụ bản in trước khi chốt hồ
              sơ.
            </p>
          )}
        </div>
      )}
      {(validation || mutation.error) && (
        <p role="alert" className="text-red-700">
          {validation ||
            getErrorMessage(
              mutation.error,
              "Không thể xác nhận lớp/ngành. Hãy tải lại trạng thái hồ sơ và thử lại.",
            )}
        </p>
      )}
      {success && (
        <p role="status" className="text-green-700">
          {success}
        </p>
      )}
    </section>
  );
}
