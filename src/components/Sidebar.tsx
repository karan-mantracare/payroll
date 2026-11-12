"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthGate";
import { useSidebar } from "./SidebarContext";
import { useNotifications } from "./NotificationsContext";
import { BrandLogo } from "./BrandLogo";
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
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Server,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  badge?: string;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Employee Management", href: "/admin/employees", icon: Users },
  { name: "Employee Lifecycle", href: "/admin/lifecycle", icon: GitFork },
  { name: "Attendance Management", href: "/admin/attendance", icon: CalendarCheck2 },
  { name: "Shift Management", href: "/admin/shifts", icon: Clock },
  { name: "Leave & Holidays", href: "/admin/leaves", icon: CalendarDays },
  { name: "Training Management", href: "/admin/training", icon: GraduationCap },
  { name: "Payroll Management", href: "/admin/payroll", icon: CreditCard, badge: "Confidential" },
  { name: "Approvals & Requests", href: "/admin/approvals", icon: CheckSquare },
  { name: "Notifications", href: "/admin/notifications", icon: Bell },
  { name: "Reports & Analytics", href: "/admin/reports", icon: BarChart3 },
  { name: "Org Settings", href: "/admin/settings", icon: Sliders },
  { name: "Access & Admin", href: "/admin/access", icon: ShieldAlert },
];

const DASH_NAV_ITEMS: NavItem[] = [
  { name: "My Dashboard", href: "/dash", icon: LayoutDashboard },
  { name: "My Profile", href: "/dash/profile", icon: User },
  { name: "My Attendance", href: "/dash/attendance", icon: CalendarCheck2 },
  { name: "My Shifts", href: "/dash/shifts", icon: Clock },
  { name: "My Leaves", href: "/dash/leaves", icon: CalendarDays },
  { name: "My Payroll", href: "/dash/payroll", icon: CreditCard },
  { name: "Onboarding & JML", href: "/dash/onboarding", icon: GitFork },
  { name: "My Training", href: "/dash/training", icon: GraduationCap },
  { name: "My Requests", href: "/dash/requests", icon: Inbox },
  { name: "Notifications", href: "/dash/notifications", icon: Bell },
  {
    name: "My Team",
    href: "/dash/team",
    icon: Users2,
    permission: "dash.team.view",
    badge: "Manager",
  },
  {
    name: "Team Approvals",
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
  const { isCollapsed, toggleCollapsed } = useSidebar();
  const { unreadCount } = useNotifications();

  const items = type === "admin" ? ADMIN_NAV_ITEMS : DASH_NAV_ITEMS;

  // Filter items by permission
  const visibleItems = items.filter((item) => {
    if (item.permission && !hasPermission(item.permission)) {
      return false;
    }
    return true;
  });

  // Desktop sidebar content
  const desktopSidebar = (
    <aside
      className={`border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-h-screen flex flex-col transition-all duration-200 ease-in-out select-none shrink-0 ${
        isCollapsed ? "w-[70px] px-2 py-3" : "w-64 px-3 py-3"
      }`}
    >
      {/* Sidebar Header */}
      <div
        className={`flex items-center pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 ${
          isCollapsed ? "flex-col gap-2 justify-center" : "justify-between px-1"
        }`}
      >
        <Link href={type === "admin" ? "/admin" : "/dash"} className="flex items-center">
          <BrandLogo size="md" compact={isCollapsed} />
        </Link>

        <button
          onClick={toggleCollapsed}
          className="p-1.5 rounded-lg text-[#293381] dark:text-slate-300 hover:bg-[#EBF7FF] dark:hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Module Section Label */}
      {!isCollapsed && (
        <div className="px-2 pt-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#293381] dark:text-[#36B4FF]">
          {type === "admin"
            ? `Admin Modules (${visibleItems.length})`
            : `Employee Modules (${visibleItems.length})`}
        </div>
      )}

      {/* Navigation List */}
      <nav
        className={`flex-1 overflow-y-auto space-y-1 pt-2 ${
          isCollapsed ? "flex flex-col items-center" : ""
        }`}
      >
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/admin" || item.href === "/dash"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          const Icon = item.icon;
          const isNotificationsItem = item.href.endsWith("/notifications");
          const hasUnreadNotifications = isNotificationsItem && unreadCount > 0;
          const badgeText = hasUnreadNotifications
            ? unreadCount > 99
              ? "99+"
              : String(unreadCount)
            : item.badge;

          if (isCollapsed) {
            // Collapsed: Icon-only with accessible floating hover tooltip
            return (
              <div key={item.href} className="relative group flex items-center justify-center my-0.5">
                <Link
                  href={item.href}
                  prefetch={false}
                  className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isActive
                      ? "bg-[#293381] text-white shadow-sm shadow-[#293381]/25"
                      : "text-[#293381] dark:text-slate-300 hover:bg-[#EBF7FF] dark:hover:bg-slate-800 hover:text-[#293381]"
                  }`}
                  aria-label={item.name}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-white" : "text-[#293381] dark:text-slate-300"
                    }`}
                  />
                  {hasUnreadNotifications && (
                    <span
                      className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900"
                      aria-hidden="true"
                    />
                  )}
                </Link>

                {/* Floating Tooltip */}
                <div
                  role="tooltip"
                  className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#293381] text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 z-50 flex items-center gap-2 border border-slate-700/30"
                >
                  <span>{item.name}</span>
                  {badgeText && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        hasUnreadNotifications
                          ? "bg-rose-500 text-white"
                          : "bg-[#36B4FF] text-[#293381]"
                      }`}
                    >
                      {badgeText}
                    </span>
                  )}
                  {/* Tooltip triangle caret */}
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-[#293381]" />
                </div>
              </div>
            );
          }

          // Expanded: Full menu item with label & compact badge
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              data-testid={isNotificationsItem ? "sidebar-notifications-link" : undefined}
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? "bg-[#293381] text-white shadow-sm shadow-[#293381]/20"
                  : "text-[#293381] dark:text-slate-300 hover:bg-[#EBF7FF] dark:hover:bg-slate-800/80 hover:text-[#293381]"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-white" : "text-[#293381] dark:text-slate-300"
                  }`}
                />
                <span className="truncate">{item.name}</span>
              </div>
              {badgeText && (
                <span
                  data-testid={isNotificationsItem ? "sidebar-notifications-unread-badge" : undefined}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ml-1.5 uppercase ${
                    hasUnreadNotifications
                      ? "bg-rose-500 text-white rounded-full min-w-[18px] text-center"
                      : isActive
                        ? "bg-white/20 text-white"
                        : "bg-[#36B4FF]/15 text-[#293381] dark:text-[#36B4FF] border border-[#36B4FF]/30"
                  }`}
                >
                  {badgeText}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      {isCollapsed ? (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-center shrink-0">
          <div
            className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group relative"
            title="Programs Mount: /payrol"
          >
            <Server className="w-4 h-4 text-[#293381]" />
            <div
              role="tooltip"
              className="absolute left-full ml-3 px-2 py-1 bg-[#293381] text-white text-[11px] font-mono rounded-md shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50"
            >
              /payrol
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl mt-3 shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center justify-between">
            <span>Mount:</span>
            <span className="text-[#293381] dark:text-[#36B4FF] font-bold">/payrol</span>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            MantraCare Ecosystem
          </div>
        </div>
      )}
    </aside>
  );

  // Mobile Drawer (Always fully expanded for mobile touch usability)
  const mobileDrawer = (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Panel */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 shadow-2xl flex flex-col p-4 border-r border-slate-200 dark:border-slate-800 z-50">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <BrandLogo size="md" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#293381] hover:bg-[#EBF7FF] dark:text-slate-300 dark:hover:bg-slate-800 transition"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-2 pt-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#293381] dark:text-[#36B4FF]">
          {type === "admin"
            ? `Admin Modules (${visibleItems.length})`
            : `Employee Modules (${visibleItems.length})`}
        </div>

        <nav className="flex-1 overflow-y-auto space-y-1 pt-2">
          {visibleItems.map((item) => {
            const isActive =
              item.href === "/admin" || item.href === "/dash"
                ? pathname === item.href
                : pathname.startsWith(item.href);

            const Icon = item.icon;
            const isNotificationsItem = item.href.endsWith("/notifications");
            const hasUnreadNotifications = isNotificationsItem && unreadCount > 0;
            const badgeText = hasUnreadNotifications
              ? unreadCount > 99
                ? "99+"
                : String(unreadCount)
              : item.badge;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? "bg-[#293381] text-white shadow-sm shadow-[#293381]/20"
                    : "text-[#293381] dark:text-slate-300 hover:bg-[#EBF7FF] dark:hover:bg-slate-800/80 hover:text-[#293381]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-white" : "text-[#293381] dark:text-slate-300"
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                </div>
                {badgeText && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ml-1.5 uppercase ${
                      hasUnreadNotifications
                        ? "bg-rose-500 text-white rounded-full min-w-[18px] text-center"
                        : isActive
                          ? "bg-white/20 text-white"
                          : "bg-[#36B4FF]/15 text-[#293381] border border-[#36B4FF]/30"
                    }`}
                  >
                    {badgeText}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl mt-3 shrink-0">
          <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between">
            <span>Mount:</span>
            <span className="text-[#293381] font-bold">/payrol</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            MantraCare Ecosystem
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:block h-full">{desktopSidebar}</div>
      {isOpen && mobileDrawer}
    </>
  );
}
