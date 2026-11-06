"use client";

import React, { ReactNode } from "react";
import { useAuth } from "@/components/AuthGate";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { SidebarProvider } from "@/components/SidebarContext";
import { ShieldAlert, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  const { canAccessEmployee, canAccessAdmin, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  if (loading) {
    return null;
  }

  if (!canAccessEmployee) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-rose-900/30 rounded-2xl p-8 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/40 text-rose-500 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#293381] dark:text-white">Employee Portal Access Denied</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your account requires the <code className="text-[#293381] dark:text-[#36B4FF] font-mono font-semibold">portal.employee.access</code> permission.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {canAccessAdmin ? (
              <Link
                href="/admin"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold rounded-lg transition shadow-sm"
              >
                <span>Go to Admin Portal</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </Link>
            ) : null}
            <button
              onClick={logout}
              className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex transition-colors">
        <Sidebar
          type="dash"
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <Navbar
            portal="Employee Portal"
            isMobileMenuOpen={mobileMenuOpen}
            onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          />
          <main className="flex-1 p-4 sm:p-8 overflow-y-auto w-full">
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
