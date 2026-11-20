import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { snapshot, currentUser } from "../data/store";
import { AUTH_API, getAccessToken } from "../api/api-session";
import { invalidateWorkflowTerms } from "./use-workflow-terms";
import type { SnapshotScope } from "../data/snapshot-api";
import { useContext } from "react";
import { SnapshotContext } from "./snapshot-context";
import { snapshotPlans } from "../data/snapshot-scope";
export function useDemo(requestedScope?: SnapshotScope) {
  const context = useContext(SnapshotContext);
  const scope = requestedScope ?? context.scope;
  const termId = snapshotPlans[scope].termScoped ? context.termId : undefined;
  const savedTermId =
    snapshotPlans[scope].termScoped && !termId
      ? context.savedTermId
      : undefined;
  return useQuery({
    queryKey:
      scope === "full"
        ? ["demo", AUTH_API ? getAccessToken() : "mock"]
        : [
            "demo",
            AUTH_API ? getAccessToken() : "mock",
            scope,
            ...(snapshotPlans[scope].termScoped
              ? [termId ?? "", savedTermId ?? ""]
              : []),
          ],
    queryFn: () => snapshot(scope, termId, savedTermId),
    // Reuse the same account's snapshot across component mounts/navigation.
    // Mutations still invalidate immediately; the API checks permissions afresh.
    staleTime: AUTH_API ? 60000 : 0,
    retry: false,
  });
}
export function useAction(options?: { invalidateTerms?: boolean }) {
  const cache = useQueryClient();
  const action = useMutation({
    mutationFn: async (fn: () => unknown | Promise<unknown>) => await fn(),
    onSuccess: () => {
      toast.success("Đã lưu thay đổi");
      // The write has succeeded. Keep reconciliation in the background rather
      // than holding the form open until every dependent API read finishes.
      const refreshes = [
        cache.invalidateQueries(
          { queryKey: ["demo"] },
          { cancelRefetch: false, throwOnError: true },
        ),
        cache.invalidateQueries(
          { queryKey: ["registration"] },
          { cancelRefetch: false, throwOnError: true },
        ),
      ];
      if (options?.invalidateTerms)
        refreshes.push(invalidateWorkflowTerms(cache));
      void Promise.all(refreshes).catch(() => {
        toast.error(
          "Đã lưu nhưng chưa tải lại được dữ liệu. Vui lòng thử tải lại.",
        );
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return {
    run: action.mutateAsync,
    pending: action.isPending,
    error: action.error,
  };
}
export function useSession() {
  const data = useDemo();
  return { ...data, user: data.data ? currentUser(data.data) : undefined };
}
