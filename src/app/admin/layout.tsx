"use client";

import React, { ReactNode } from "react";
import { useAuth } from "@/components/AuthGate";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { ShieldAlert, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { canAccessAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  if (!canAccessAdmin) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-rose-900/30 rounded-2xl p-8 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Admin Portal Access Denied</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your account requires the <code className="text-[#293381] dark:text-[#36B4FF] font-mono font-semibold">portal.admin.access</code> permission to enter the Admin Portal.
          </p>
          <div className="pt-2">
            <Link
              href="/dash"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold rounded-lg transition shadow-sm"
            >
              <span>Go to Employee Portal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col transition-colors">
      <Navbar
        portal="Admin Portal"
        isMobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />
      <div className="flex flex-1">
        <Sidebar
          type="admin"
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto max-w-7xl">
          {children}
        </main>
      </div>
    </div>
  );
}
