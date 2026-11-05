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
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 backdrop-blur px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors shadow-sm shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile: Hamburger Menu + Logo */}
        <div className="flex md:hidden items-center gap-2">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="p-1.5 rounded-lg text-[#293381] hover:bg-[#EBF7FF] dark:text-slate-300 dark:hover:bg-slate-800 transition"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
          <BrandLogo size="md" />
        </div>

        {/* Portal Identifier Badge & Title */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-[#293381]/10 text-[#293381] dark:bg-[#36B4FF]/15 dark:text-[#36B4FF] border border-[#293381]/20 dark:border-[#36B4FF]/30">
            {portal}
          </span>
          <span className="text-xs text-slate-400 hidden sm:inline">•</span>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
            Enterprise Workforce & Payroll Suite
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Portal Switcher */}
        <PortalSwitcher />

        {/* Theme Toggle (Light / Dark) */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-[#293381] hover:bg-[#EBF7FF] dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle Light/Dark Theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#293381]" />}
        </button>

        {/* User Profile & Role Info */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="text-right hidden md:block">
            <div className="text-sm font-semibold text-[#293381] dark:text-white flex items-center justify-end gap-1.5">
              {user?.name}
              {user?.isSuperAdmin && (
                <span title="Super Administrator">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1">
              <span className="font-mono text-[#293381] dark:text-[#36B4FF] font-medium">
                {user?.employeeId || "EMP"}
              </span>
              <span>•</span>
              <span className="truncate max-w-[130px] font-medium">{user?.roles.join(", ")}</span>
            </div>
          </div>

          <div className="w-8 h-8 rounded-full bg-[#293381] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            {user?.name ? user.name.charAt(0) : <User className="w-4 h-4" />}
          </div>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition focus:outline-none focus:ring-2 focus:ring-rose-400"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
