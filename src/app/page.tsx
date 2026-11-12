"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/AuthGate";
import { Loader2 } from "lucide-react";

export default function RootRedirector() {
  const { user, status, loading, canAccessAdmin, canAccessEmployee } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (status === "unauthenticated" || !user) {
      window.location.replace("/payroll/login");
    } else if (canAccessAdmin) {
      window.location.replace("/payroll/admin");
    } else if (canAccessEmployee) {
      window.location.replace("/payroll/dash");
    } else {
      window.location.replace("/payroll/login");
    }
  }, [user, status, loading, canAccessAdmin, canAccessEmployee]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#293381] dark:text-[#36B4FF]" />
        <span>Routing to authorized portal...</span>
      </div>
    </div>
  );
}
