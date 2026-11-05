"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthGate";
import { PortalSwitcher } from "./PortalSwitcher";
import { LogOut, User, ShieldCheck, Sun, Moon, Menu, X } from "lucide-react";

interface NavbarProps {
  portal: "Admin Portal" | "Employee Portal";
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export function Navbar({ portal, onToggleMobileMenu, isMobileMenuOpen }: NavbarProps) {
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
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

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Portal Switcher */}
        <PortalSwitcher />

        {/* Theme Toggle (Light / Dark) */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle Light/Dark Theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
        </button>

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
