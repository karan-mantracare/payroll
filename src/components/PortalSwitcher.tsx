"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthGate";
import { ArrowLeftRight, Shield, User } from "lucide-react";

export function PortalSwitcher() {
  const { canAccessAdmin, canAccessEmployee } = useAuth();
  const pathname = usePathname();

  // If user only has access to one portal, don't show switcher
  if (!canAccessAdmin || !canAccessEmployee) {
    return null;
  }

  const isAdmin = pathname.startsWith("/admin");
  const targetHref = isAdmin ? "/dash" : "/admin";
  const targetLabel = isAdmin ? "Switch to Employee Portal" : "Switch to Admin Portal";

  return (
    <Link
      href={targetHref}
      prefetch={false}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#36B4FF]/10 hover:bg-[#36B4FF]/20 text-[#293381] dark:text-[#36B4FF] border border-[#36B4FF]/30 transition shadow-sm"
      title={targetLabel}
    >
      <ArrowLeftRight className="w-3.5 h-3.5 text-[#36B4FF]" />
      <span className="hidden sm:inline font-bold">{targetLabel}</span>
      <span className="sm:hidden font-bold">{isAdmin ? "Employee" : "Admin"}</span>
    </Link>
  );
}
