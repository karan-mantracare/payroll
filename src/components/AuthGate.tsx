"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { ShieldAlert, CheckCircle2, Loader2, KeyRound, Building2 } from "lucide-react";

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
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  useEffect(() => {
    async function initAuth() {
      // 1. Check for token in URL query string
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("token");

      if (urlToken) {
        try {
          // Handshake server-to-server
          const res = await fetch("/payrol/api/auth/handshake", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: urlToken }),
          });

          const data = await res.json();

          if (!res.ok) {
            setError({
              message: data.error || "Handshake failed",
              code: data.code || "HANDSHAKE_ERROR",
            });
            setLoading(false);
            return;
          }

          // Strip token from address bar immediately to prevent leakage
          const cleanUrl = window.location.pathname + window.location.hash;
          window.history.replaceState(null, "", cleanUrl);

          setUser(data.user);
          setLoading(false);
          return;
        } catch (err: any) {
          setError({ message: err.message, code: "NETWORK_ERROR" });
          setLoading(false);
          return;
        }
      }

      // 2. No token in URL, check existing session cookie
      try {
        const res = await fetch("/payrol/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setUser(data.user);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        // Fall through to unauthenticated state
      }

      setLoading(false);
    }

    initAuth();
  }, []);

  const logout = async () => {
    try {
      await fetch("/payrol/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      window.location.href = "/payrol";
    }
  };

  const hasPermission = (perm: string): boolean => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return user.permissions.includes(perm);
  };

  const canAccessAdmin =
    user?.isSuperAdmin || (user ? user.permissions.includes("portal.admin.access") : false);
  const canAccessEmployee =
    user?.isSuperAdmin || (user ? user.permissions.includes("portal.employee.access") : false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white px-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Securing Your Session</h2>
          <p className="text-sm text-slate-400">
            Validating Programs identity with MantraCare platform and enforcing data scopes...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white px-4">
        <div className="bg-slate-800 border border-red-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-red-400">Authentication Blocked</h2>
          <p className="text-sm text-slate-300">{error.message}</p>
          <div className="bg-slate-900/80 rounded-lg p-3 text-xs font-mono text-slate-400 text-left">
            Error Code: <span className="text-red-400 font-semibold">{error.code || "AUTH_FAILED"}</span>
          </div>
          <p className="text-xs text-slate-500">
            Please enter through <code className="text-indigo-400">web.mantracare.com</code> or contact HR administration if you believe this is an error.
          </p>
          <button
            onClick={() => {
              setError(null);
              window.location.href = "/payrol";
            }}
            className="w-full mt-4 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg text-sm transition"
          >
            Retry Handshake
          </button>
        </div>
      </div>
    );
  }

  // Not logged in: Show local test handshake switcher for rapid evaluation & testing
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white px-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-xl w-full shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5" /> MantraCare HRMS & Payroll
            </div>
            <h1 className="text-2xl font-bold">Programs Platform Handshake Required</h1>
            <p className="text-sm text-slate-400">
              In production, access is bootstrapped via a single-use token from{" "}
              <code className="text-indigo-300">programs.mantracare.com?token=...</code>.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Quick Test Personas (Local Development Mode):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { name: "Super Admin", role: "SUPER_ADMIN", token: "test-token-superadmin", desc: "Full organization bypass access" },
                { name: "Payroll Admin", role: "ADMIN", token: "test-token-admin", desc: "Admin + Employee portal access" },
                { name: "HR Manager", role: "HR_MANAGER", token: "test-token-hrmanager", desc: "HR approvals & lifecycle" },
                { name: "HR Executive", role: "HR_EXECUTIVE", token: "test-token-hrexecutive", desc: "Department level HR ops" },
                { name: "Team Manager", role: "TEAM_MANAGER", token: "test-token-teammanager", desc: "Direct reports scope & team approvals" },
                { name: "Standard Employee", role: "EMPLOYEE", token: "test-token-employee", desc: "Self-service employee portal" },
                { name: "Multi-Role User", role: "EMPLOYEE + TM + ADMIN", token: "test-token-multirole", desc: "Multi-role combined permissions" },
              ].map((persona) => (
                <button
                  key={persona.token}
                  onClick={() => {
                    window.location.href = `/payrol?token=${persona.token}`;
                  }}
                  className="flex flex-col text-left p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/50 transition group"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium text-sm text-white group-hover:text-indigo-300 transition">
                      {persona.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                      {persona.role}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1">{persona.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error: null,
        logout,
        hasPermission,
        canAccessAdmin: !!canAccessAdmin,
        canAccessEmployee: !!canAccessEmployee,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
