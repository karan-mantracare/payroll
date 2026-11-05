"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { Loader2 } from "lucide-react";

export default function RootRedirector() {
  const router = useRouter();
  const { user, canAccessAdmin, canAccessEmployee } = useAuth();

  useEffect(() => {
    if (!user) return;

    if (canAccessAdmin) {
      router.replace("/admin");
    } else if (canAccessEmployee) {
      router.replace("/dash");
    }
  }, [user, canAccessAdmin, canAccessEmployee, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        <span>Routing to authorized portal...</span>
      </div>
    </div>
  );
}
