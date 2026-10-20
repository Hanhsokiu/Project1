import { useState, useEffect } from 'react';

interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
}

/**
 * Hook for accessing current authenticated user.
 * Reads token from localStorage and exposes helpers for permission checks.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setIsLoading(false);
      return;
    }
    // TODO: Validate token via /api/auth/me and populate user state
    setIsLoading(false);
  }, []);

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    window.location.href = '/login';
  };

  const hasPermission = (permission: string) =>
    user?.permissions.includes(permission) ?? false;

  const hasRole = (role: string) =>
    user?.roles.includes(role) ?? false;

  return { user, isAuthenticated: !!user, isLoading, setUser, logout, hasPermission, hasRole };
}
