import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { snapshot, currentUser } from "../data/store";
import { AUTH_API, getAccessToken } from "../api/api-session";
export function useDemo() {
  return useQuery({
    queryKey: ["demo", AUTH_API ? getAccessToken() : "mock"],
    queryFn: snapshot,
    staleTime: 0,
    retry: false,
    refetchInterval:
      import.meta.env.VITE_REGISTRATION_API === "true" ? 30000 : false,
  });
}
export function useAction() {
  const cache = useQueryClient();
  const action = useMutation({
    mutationFn: async (fn: () => unknown | Promise<unknown>) => await fn(),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["demo"] });
      await cache.invalidateQueries({ queryKey: ["registration"] });
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
