"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthGate";
import { PortalSwitcher } from "./PortalSwitcher";
import { BrandLogo } from "./BrandLogo";
import { LogOut, User, ShieldCheck, Sun, Moon, Menu, X } from "lucide-react";

interface NavbarProps {
  portal: "Admin Portal" | "Employee Portal";
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export function Navbar({ portal, onToggleMobileMenu, isMobileMenuOpen }: NavbarProps) {
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState<boolean>(false);

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
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 backdrop-blur px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors shadow-sm">
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        {/* Official Brand Logo */}
        <BrandLogo size="md" />

        <div className="border-l border-slate-200 dark:border-slate-800 pl-3 ml-1">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-[#293381]/10 text-[#293381] dark:bg-[#36B4FF]/10 dark:text-[#36B4FF] border border-[#293381]/20 dark:border-[#36B4FF]/20">
              {portal}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
            Enterprise HRMS & Payroll
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Portal Switcher */}
        <PortalSwitcher />

        {/* Theme Toggle (Light / Dark) */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title={isDark ? "Switch to Light Mode (Default)" : "Switch to Dark Mode"}
          aria-label="Toggle Light/Dark Theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#293381]" />}
        </button>

        {/* User Profile & Role Info */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="text-right hidden md:block">
            <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-end gap-1.5">
              {user?.name}
              {user?.isSuperAdmin && (
                <span title="Super Administrator">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1">
              <span className="font-mono text-[#293381] dark:text-[#36B4FF] font-medium">{user?.employeeId || "EMP"}</span>
              <span>•</span>
              <span className="truncate max-w-[140px]">{user?.roles.join(", ")}</span>
            </div>
          </div>

          <div className="w-8 h-8 rounded-full bg-[#293381]/10 dark:bg-slate-800 border border-[#293381]/20 dark:border-slate-700 flex items-center justify-center text-[#293381] dark:text-[#36B4FF] font-bold text-xs">
            {user?.name ? user.name.charAt(0) : <User className="w-4 h-4" />}
          </div>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
            title="Log Out & Invalidate Session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
