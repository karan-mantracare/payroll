"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Loader2, AlertCircle, RefreshCw, LogIn } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "forbidden" | "error";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  employeeId?: string;
  widestScope?: string;
  isSuperAdmin?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  status: AuthStatus;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  canAccessAdmin: boolean;
  canAccessEmployee: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthGate");
  }
  return context;
}

// Global in-flight promise tracker to deduplicate simultaneous requests
let inFlightSessionCheck: Promise<AuthUser | null> | null = null;
let cachedClientUser: AuthUser | null = null;

const REQUEST_TIMEOUT_MS = 4000; // 4 seconds max before failing safely

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(cachedClientUser);
  const [status, setStatus] = useState<AuthStatus>(cachedClientUser ? "authenticated" : "loading");
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();
  const abortControllerRef = useRef<AbortController | null>(null);

  const isLoginPage = pathname === "/login" || pathname === "/payrol/login";
  const isRootPath = pathname === "/" || pathname === "/payrol" || pathname === "";

  const checkSession = useCallback(async (force = false) => {
    // If we already have a validated user in memory and not forcing revalidation, reuse it
    if (!force && cachedClientUser) {
      setUser(cachedClientUser);
      setStatus("authenticated");
      setError(null);
      return;
    }

    if (inFlightSessionCheck) {
      try {
        const existingUser = await inFlightSessionCheck;
        if (existingUser) {
          setUser(existingUser);
          setStatus("authenticated");
          setError(null);
        } else {
          setUser(null);
          setStatus("unauthenticated");
        }
      } catch (err: any) {
        setStatus("error");
        setError(err?.message || "Session verification failed.");
      }
      return;
    }

    setStatus((prev) => (prev === "authenticated" ? "authenticated" : "loading"));
    setError(null);

    // Cancel any previous pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    inFlightSessionCheck = (async (): Promise<AuthUser | null> => {
      try {
        const res = await fetch("/payrol/api/auth/me", {
          signal: controller.signal,
          headers: { "Cache-Control": "no-cache" },
        });

        clearTimeout(timeoutId);

        if (res.status === 401) {
          cachedClientUser = null;
          return null;
        }

        if (res.status === 403) {
          throw new Error("FORBIDDEN");
        }

        if (!res.ok) {
          throw new Error(`HTTP_${res.status}`);
        }

        const data = await res.json();
        const raw = data.user;
        if (!raw) {
          cachedClientUser = null;
          return null;
        }

        const resolvedUser: AuthUser = {
          ...raw,
          roles: Array.isArray(raw.roles) ? raw.roles : [],
          permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
        };

        cachedClientUser = resolvedUser;
        return resolvedUser;
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === "AbortError") {
          throw new Error("TIMEOUT");
        }
        throw fetchErr;
      } finally {
        inFlightSessionCheck = null;
      }
    })();

    try {
      const resolved = await inFlightSessionCheck;
      if (resolved) {
        setUser(resolved);
        setStatus("authenticated");
        setError(null);
      } else {
        setUser(null);
        setStatus("unauthenticated");
        setError(null);
      }
    } catch (err: any) {
      if (err.message === "FORBIDDEN") {
        setStatus("forbidden");
        setError("Your account does not have authorization to access this service.");
      } else if (err.message === "TIMEOUT") {
        setStatus("error");
        setError("Session verification timed out. Please check your connection or retry.");
      } else {
        setStatus("error");
        setError("Unable to verify secure session. Please try again.");
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Handle redirects once session state is resolved
  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      if (!isLoginPage && !isRootPath) {
        window.location.href = "/payrol/login";
      }
    }
  }, [status, isLoginPage, isRootPath]);

  const logout = async () => {
    try {
      await fetch("/payrol/api/auth/logout", { method: "POST" });
    } catch {}
    cachedClientUser = null;
    setUser(null);
    setStatus("unauthenticated");
    window.location.href = "/payrol/login";
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    if (!Array.isArray(user.permissions)) return false;
    return user.permissions.includes(permission);
  };

  const canAccessAdmin =
    Boolean(user?.isSuperAdmin) ||
    (Array.isArray(user?.permissions) && user.permissions.includes("portal.admin.access"));

  const canAccessEmployee =
    Boolean(user?.isSuperAdmin) ||
    (Array.isArray(user?.permissions) && user.permissions.includes("portal.employee.access"));

  // 1. If on login page, render form IMMEDIATELY without waiting for session resolution
  if (isLoginPage) {
    return (
      <AuthContext.Provider
        value={{
          user,
          status,
          loading: status === "loading",
          error,
          logout,
          hasPermission,
          canAccessAdmin,
          canAccessEmployee,
          refreshUser: () => checkSession(true),
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  // 2. If verification timed out or threw an unexpected server error, render a deterministic, retryable error screen
  if (status === "error") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-rose-900/30 rounded-2xl p-8 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/40 text-rose-500 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#293381] dark:text-white">Authentication Verification Issue</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {error || "An error occurred while verifying your session permissions."}
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => checkSession(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold rounded-lg transition shadow-sm"
            >
              <RefreshCw className="w-4 h-4 text-white" />
              <span>Retry Verification</span>
            </button>
            <button
              onClick={logout}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition"
            >
              <LogIn className="w-4 h-4" />
              <span>Return to Sign In</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. If loading session on protected pages, show bounded branded spinner (max 4 seconds)
  if (status === "loading" && !cachedClientUser) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-slate-900 dark:text-white px-4">
        <div className="bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 max-w-sm w-full shadow-lg text-center space-y-4">
          <BrandLogo size="lg" className="mx-auto mb-2" />
          <div className="w-12 h-12 bg-[#36B4FF]/10 text-[#36B4FF] rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="w-6 h-6 animate-spin text-[#293381]" />
          </div>
          <h2 className="text-sm font-bold text-[#293381] dark:text-white">Verifying Authentication</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Checking secure session permissions...
          </p>
        </div>
      </div>
    );
  }

  // 4. If unauthenticated on protected pages, render redirecting placeholder
  if (status === "unauthenticated" && !isLoginPage) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-slate-900 dark:text-white px-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-[#293381]" />
          <span>Redirecting to login...</span>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        loading: status === "loading",
        error,
        logout,
        hasPermission,
        canAccessAdmin,
        canAccessEmployee,
        refreshUser: () => checkSession(true),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
