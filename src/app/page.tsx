"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { Loader2 } from "lucide-react";

export default function RootRedirector() {
  const router = useRouter();
  const { user, loading, canAccessAdmin, canAccessEmployee } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
    } else if (canAccessAdmin) {
      router.replace("/admin");
    } else if (canAccessEmployee) {
      router.replace("/dash");
    } else {
      router.replace("/login");
    }
  }, [user, loading, canAccessAdmin, canAccessEmployee, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#293381] dark:text-[#36B4FF]" />
        <span>Routing to authorized portal...</span>
      </div>
    </div>
  );
}
