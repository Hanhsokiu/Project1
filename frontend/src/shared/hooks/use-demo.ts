import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { snapshot, currentUser } from "../data/store";
import { AUTH_API, getAccessToken } from "../api/api-session";
import { invalidateWorkflowTerms } from "./use-workflow-terms";
export function useDemo() {
  return useQuery({
    queryKey: ["demo", AUTH_API ? getAccessToken() : "mock"],
    queryFn: snapshot,
    // Reuse the same account's snapshot across component mounts/navigation.
    // Mutations still invalidate immediately; the API checks permissions afresh.
    staleTime: AUTH_API ? 15000 : 0,
    retry: false,
  });
}
export function useAction(options?: { invalidateTerms?: boolean }) {
  const cache = useQueryClient();
  const action = useMutation({
    mutationFn: async (fn: () => unknown | Promise<unknown>) => await fn(),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["demo"] });
      await cache.invalidateQueries({ queryKey: ["registration"] });
      if (options?.invalidateTerms) await invalidateWorkflowTerms(cache);
      toast.success("Đã lưu thay đổi");
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
