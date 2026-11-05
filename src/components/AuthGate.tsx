"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { ShieldAlert, CheckCircle2, Loader2, KeyRound, Building2 } from "lucide-react";
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
              code: data.code,
            });
            setLoading(false);
            return;
          }

          setUser(data.user);

          // Clean token from URL in browser bar without refresh to prevent leak in history
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
          setLoading(false);
          return;
        } catch (err: any) {
          setError({
            message: `Handshake network failure: ${err.message}`,
            code: "NETWORK_ERROR",
          });
          setLoading(false);
          return;
        }
      }

      // 2. No URL token: check existing session cookie via /api/auth/me
      try {
        const res = await fetch("/payrol/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    initAuth();
  }, []);

  const logout = async () => {
    try {
      await fetch("/payrol/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
    window.location.href = "/payrol";
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return user.permissions.includes(permission);
  };

  const canAccessAdmin =
    user?.isSuperAdmin || (user ? user.permissions.includes("portal.admin.access") : false);

  const canAccessEmployee =
    user?.isSuperAdmin || (user ? user.permissions.includes("portal.employee.access") : false);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-slate-900 dark:text-white px-4">
        <div className="bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-lg text-center space-y-4">
          <BrandLogo size="lg" className="mx-auto mb-2" />
          <div className="w-14 h-14 bg-[#36B4FF]/10 text-[#36B4FF] rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Loader2 className="w-7 h-7 animate-spin text-[#293381]" />
          </div>
          <h2 className="text-lg font-bold text-[#293381] dark:text-white">Securing Your Session</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Validating Programs identity with MantraCare platform and enforcing data scopes...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-slate-900 dark:text-white px-4">
        <div className="bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/40 rounded-2xl p-8 max-w-md w-full shadow-xl text-center space-y-4">
          <BrandLogo size="lg" className="mx-auto mb-2" />
          <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-rose-600 dark:text-rose-400">Authentication Blocked</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">{error.message}</p>
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-xs font-mono text-slate-500 text-left border border-slate-200 dark:border-slate-800">
            Error Code: <span className="text-rose-600 font-semibold">{error.code || "AUTH_FAILED"}</span>
          </div>
          <p className="text-xs text-slate-400">
            Please enter through <code className="text-[#293381] dark:text-[#36B4FF] font-semibold">programs.mantracare.com</code> or contact HR administration.
          </p>
          <button
            onClick={() => {
              setError(null);
              window.location.href = "/payrol";
            }}
            className="w-full mt-4 py-2 px-4 bg-[#293381] hover:bg-[#1F2664] text-white font-semibold rounded-lg text-xs transition shadow-sm"
          >
            Retry Handshake
          </button>
        </div>
      </div>
    );
  }

  // Not logged in: Show test handshake switcher
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col items-center justify-center text-slate-900 dark:text-white px-4 py-8">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-xl w-full shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <BrandLogo size="lg" className="mx-auto mb-1" />
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#293381]/10 text-[#293381] text-xs font-bold">
              <Building2 className="w-3.5 h-3.5 text-[#36B4FF]" /> MantraCare HRMS & Payroll
            </div>
            <h1 className="text-xl font-bold text-[#293381] dark:text-white">Programs Platform Handshake</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Access is authenticated through a single-use token from{" "}
              <code className="text-[#293381] dark:text-[#36B4FF] font-mono font-semibold">programs.mantracare.com?token=...</code>
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Select Test Persona (Development Mode):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { name: "Super Admin", role: "SUPER_ADMIN", token: "test-token-superadmin", desc: "Full organization bypass access" },
                { name: "Admin", role: "ADMIN", token: "test-token-admin", desc: "Full operations & payroll access" },
                { name: "HR Manager", role: "HR_MANAGER", token: "test-token-hrmanager", desc: "Employee lifecycle & leaves" },
                { name: "HR Executive", role: "HR_EXECUTIVE", token: "test-token-hrexecutive", desc: "Dept scoped records & attendance" },
                { name: "Team Manager", role: "TEAM_MANAGER", token: "test-token-teammanager", desc: "Direct reports & team approvals" },
                { name: "Standard Employee", role: "EMPLOYEE", token: "test-token-employee", desc: "Self-service payslips & leaves" },
                { name: "Multi-Role User", role: "MULTI_ROLE", token: "test-token-multirole", desc: "Employee + Manager + Admin" },
              ].map((persona) => (
                <button
                  key={persona.token}
                  onClick={() => {
                    window.location.href = `/payrol?token=${persona.token}`;
                  }}
                  className="p-3 text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 hover:border-[#36B4FF] hover:bg-[#EBF7FF] dark:hover:bg-slate-800 transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-[#293381] dark:group-hover:text-[#36B4FF]">
                      {persona.name}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-[#293381] dark:text-[#36B4FF] bg-[#293381]/10 px-1.5 py-0.5 rounded">
                      {persona.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{persona.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, loading, error: null, logout, hasPermission, canAccessAdmin, canAccessEmployee }}>{children}</AuthContext.Provider>;
}
