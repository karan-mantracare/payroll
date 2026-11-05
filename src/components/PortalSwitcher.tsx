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
  const TargetIcon = isAdmin ? User : Shield;

  return (
    <Link
      href={targetHref}
      prefetch={false}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 transition shadow-sm"
      title={targetLabel}
    >
      <ArrowLeftRight className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{targetLabel}</span>
      <span className="sm:hidden">{isAdmin ? "Employee" : "Admin"}</span>
    </Link>
  );
}

