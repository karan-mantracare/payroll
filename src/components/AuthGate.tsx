"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

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

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  const isLoginPage = pathname === "/login" || pathname === "/payrol/login";

  async function checkSession() {
    try {
      const res = await fetch("/payrol/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        const rawUser = data.user;
        if (rawUser) {
          setUser({
            ...rawUser,
            roles: Array.isArray(rawUser.roles) ? rawUser.roles : [],
            permissions: Array.isArray(rawUser.permissions) ? rawUser.permissions : [],
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkSession();
  }, []);

  // Handle redirects once session state is resolved
  useEffect(() => {
    if (loading) return;

    if (!user) {
      // Unauthenticated user trying to access protected paths
      if (!isLoginPage) {
        window.location.href = "/payrol/login";
      }
    }
  }, [loading, user, isLoginPage]);

  const logout = async () => {
    try {
      await fetch("/payrol/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
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

  // If on login page and not authenticated, render login form immediately
  if (isLoginPage && (!user || loading)) {
    return (
      <AuthContext.Provider
        value={{
          user,
          loading,
          error,
          logout,
          hasPermission,
          canAccessAdmin,
          canAccessEmployee,
          refreshUser: checkSession,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  // If loading session on protected pages, show clean branded loading spinner
  if (loading) {
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

  // If not authenticated and not on login page, redirecting in progress
  if (!user && !isLoginPage) {
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
        loading,
        error,
        logout,
        hasPermission,
        canAccessAdmin,
        canAccessEmployee,
        refreshUser: checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
