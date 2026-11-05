"use client";

import React from "react";
import { useAuth } from "./AuthGate";
import { PortalSwitcher } from "./PortalSwitcher";
import { LogOut, User, Building2, ShieldCheck } from "lucide-react";

interface NavbarProps {
  portal: "Admin Portal" | "Employee Portal";
}

export function Navbar({ portal }: NavbarProps) {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/30">
          MC
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white">MantraCare</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {portal}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Enterprise HRMS & Payroll System
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Portal Switcher */}
        <PortalSwitcher />

        {/* User Profile & Role Info */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
          <div className="text-right hidden md:block">
            <div className="text-sm font-medium text-white flex items-center justify-end gap-1.5">
              {user?.name}
              {user?.isSuperAdmin && (
                <span title="Super Administrator">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-end gap-1">
              <span className="font-mono text-indigo-400">{user?.employeeId || "EMP"}</span>
              <span>•</span>
              <span className="truncate max-w-[140px]">{user?.roles.join(", ")}</span>
            </div>
          </div>

          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <User className="w-4 h-4" />
          </div>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
            title="Log Out & Invalidate Session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
