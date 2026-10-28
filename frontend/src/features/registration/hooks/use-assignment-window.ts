import { useQuery } from "@tanstack/react-query";
import { apiData } from "../../../shared/api/api-data";
import { getAccessToken } from "../../../shared/api/api-session";
import { STEP3_API } from "../services/assignment-api";

interface AssignmentWindow {
  canWrite: boolean;
  reason: string | null;
  serverNow: string;
  startAt: string | null;
  endAt: string | null;
}

export function useAssignmentWindow(termId: string) {
  const query = useQuery({
    queryKey: ["registration", "assignment-window", getAccessToken(), termId],
    queryFn: () =>
      apiData<AssignmentWindow>(
        "GET",
        `/terms/${termId}/operation-window?phaseCode=ASSIGNMENT`,
      ),
    enabled: STEP3_API && !!termId,
    retry: false,
    staleTime: 0,
    refetchInterval: 10000,
  });
  const blockedReason = !STEP3_API
    ? ""
    : query.isError
      ? `Không kiểm tra được thời gian phân công: ${query.error.message}`
      : !query.data
        ? "Đang kiểm tra thời gian phân công trên máy chủ…"
        : query.data.canWrite
          ? ""
          : query.data.reason || "Hiện chưa được phép phân công.";
  return { ...query, blockedReason };
}
