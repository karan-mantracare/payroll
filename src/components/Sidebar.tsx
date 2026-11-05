"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthGate";
import {
  LayoutDashboard,
  Users,
  GitFork,
  CalendarCheck2,
  Clock,
  CalendarDays,
  GraduationCap,
  CreditCard,
  CheckSquare,
  BarChart3,
  Sliders,
  ShieldAlert,
  User,
  Users2,
  Inbox,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  badge?: string;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { name: "1. Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "2. Employee Management", href: "/admin/employees", icon: Users },
  { name: "3. Employee Lifecycle", href: "/admin/lifecycle", icon: GitFork },
  { name: "4. Attendance Management", href: "/admin/attendance", icon: CalendarCheck2 },
  { name: "5. Shift Management", href: "/admin/shifts", icon: Clock },
  { name: "6. Leave & Holidays", href: "/admin/leaves", icon: CalendarDays },
  { name: "7. Training Management", href: "/admin/training", icon: GraduationCap },
  { name: "8. Payroll Management", href: "/admin/payroll", icon: CreditCard, badge: "Confidential" },
  { name: "9. Approvals & Requests", href: "/admin/approvals", icon: CheckSquare },
  { name: "10. Reports & Analytics", href: "/admin/reports", icon: BarChart3 },
  { name: "11. Org Settings", href: "/admin/settings", icon: Sliders },
  { name: "12. Access & Admin", href: "/admin/access", icon: ShieldAlert },
];

const DASH_NAV_ITEMS: NavItem[] = [
  { name: "1. My Dashboard", href: "/dash", icon: LayoutDashboard },
  { name: "2. My Profile", href: "/dash/profile", icon: User },
  { name: "3. My Attendance", href: "/dash/attendance", icon: CalendarCheck2 },
  { name: "4. My Shifts", href: "/dash/shifts", icon: Clock },
  { name: "5. My Leaves", href: "/dash/leaves", icon: CalendarDays },
  { name: "6. My Payroll", href: "/dash/payroll", icon: CreditCard },
  { name: "7. Onboarding & JML", href: "/dash/onboarding", icon: GitFork },
  { name: "8. My Training", href: "/dash/training", icon: GraduationCap },
  { name: "9. My Requests", href: "/dash/requests", icon: Inbox },
  {
    name: "10. My Team",
    href: "/dash/team",
    icon: Users2,
    permission: "dash.team.view",
    badge: "Manager",
  },
  {
    name: "11. Team Approvals",
    href: "/dash/approvals",
    icon: CheckSquare,
    permission: "dash.team_approvals.manage",
    badge: "Manager",
  },
];

interface SidebarProps {
  type: "admin" | "dash";
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ type, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  const items = type === "admin" ? ADMIN_NAV_ITEMS : DASH_NAV_ITEMS;

  const sidebarContent = (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 min-h-[calc(100vh-4rem)] flex flex-col py-4 px-3 h-full transition-colors">
      <div className="px-3 pb-3 text-[11px] font-bold uppercase tracking-wider text-[#293381] dark:text-[#36B4FF]">
        {type === "admin" ? "Admin Modules (12)" : "Employee Modules (11)"}
      </div>

      <nav className="space-y-1 flex-1 overflow-y-auto">
        {items.map((item) => {
          // If the item requires a specific permission, evaluate it
          if (item.permission && !hasPermission(item.permission)) {
            return null;
          }

          const isActive =
            item.href === "/admin" || item.href === "/dash"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={() => {
                if (onClose) onClose();
              }}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition ${
                isActive
                  ? "bg-[#293381] text-white shadow-sm shadow-[#293381]/20"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-[#293381] dark:hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? "text-[#36B4FF]" : "text-slate-400 group-hover:text-[#293381]"
                  }`}
                />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-[#36B4FF]/10 text-[#293381] dark:text-[#36B4FF] border border-[#36B4FF]/20"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 bg-[#F8FAFC] dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl mt-4">
        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          Programs Mount: <span className="text-[#293381] dark:text-[#36B4FF] font-bold">/payrol</span>
        </div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
          MantraCare Ecosystem Active
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block">{sidebarContent}</div>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 w-64 z-50 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
