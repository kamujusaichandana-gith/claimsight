import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AUTH_TOKEN_KEY, apiClient } from "../api/client";
import type { AuthResponse, User } from "../types";
import { authContext } from "./auth-context";
import type { LoginInput, RegisterInput } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(localStorage.getItem(AUTH_TOKEN_KEY)));

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return;

    let active = true;
    apiClient
      .get<{ user: User }>("/api/auth/me")
      .then(({ data }) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const { data } = await apiClient.post<AuthResponse>("/api/auth/login", input);
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { data } = await apiClient.post<AuthResponse>("/api/auth/register", input);
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading, login, register, logout],
  );

  return <authContext.Provider value={value}>{children}</authContext.Provider>;
}
