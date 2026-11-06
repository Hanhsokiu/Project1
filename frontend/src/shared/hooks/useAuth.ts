import { AUTH_API } from "../api/api-session";
import { useSession } from "./use-demo";
import { authService } from "../../features/auth/services/auth-service";
export function useAuth() {
  const { user, isPending } = useSession();
  return {
    user,
    isAuthenticated: !!user,
    isLoading: isPending,
    logout: authService.logout,
    hasRole: (role: string) => user?.roles.some((r) => r === role) || false,
    hasPermission: (permission: string) =>
      (AUTH_API ? user?.permissions?.includes(permission) : user?.roles.includes("ADMIN")) || false,
  };
}
