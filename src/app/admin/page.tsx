"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import Link from "next/link";
import {
  Users,
  ShieldCheck,
  Building,
  CreditCard,
  CalendarCheck,
  ArrowRight,
  TrendingUp,
  Clock,
  CalendarDays,
  CheckSquare,
  BarChart3,
} from "lucide-react";

interface AdminQuickLink {
  name: string;
  href: string;
  tag: string;
  icon: React.ComponentType<{ className?: string }>;
  cardGradient: string;
  iconBg: string;
  iconColor: string;
}

const ADMIN_QUICK_LINKS: AdminQuickLink[] = [
  {
    name: "Employee Management",
    href: "/admin/employees",
    tag: "Directory & Profiles",
    icon: Users,
    cardGradient: "from-[#36B4FF]/40 via-[#293381]/25 to-transparent",
    iconBg: "bg-blue-50/80 dark:bg-blue-950/30 border-blue-100 dark:border-blue-800/50",
    iconColor: "text-[#293381] dark:text-[#36B4FF]",
  },
  {
    name: "Shift Management",
    href: "/admin/shifts",
    tag: "Rosters & Schedules",
    icon: Clock,
    cardGradient: "from-cyan-400/35 via-sky-300/15 to-transparent",
    iconBg: "bg-cyan-50/80 dark:bg-cyan-950/30 border-cyan-100 dark:border-cyan-800/50",
    iconColor: "text-cyan-600 dark:text-cyan-400",
  },
  {
    name: "Payroll Management",
    href: "/admin/payroll",
    tag: "Salary & Statutory",
    icon: CreditCard,
    cardGradient: "from-emerald-400/35 via-teal-300/15 to-transparent",
    iconBg: "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-800/50",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    name: "Leave & Holiday",
    href: "/admin/leaves",
    tag: "Policies & Calendar",
    icon: CalendarDays,
    cardGradient: "from-amber-400/35 via-orange-300/15 to-transparent",
    iconBg: "bg-amber-50/80 dark:bg-amber-950/30 border-amber-100 dark:border-amber-800/50",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    name: "Approvals & Requests",
    href: "/admin/approvals",
    tag: "Multi-tier Workflows",
    icon: CheckSquare,
    cardGradient: "from-rose-400/35 via-pink-300/15 to-transparent",
    iconBg: "bg-rose-50/80 dark:bg-rose-950/30 border-rose-100 dark:border-rose-800/50",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  {
    name: "Reports & Analytics",
    href: "/admin/reports",
    tag: "Audits & Insights",
    icon: BarChart3,
    cardGradient: "from-indigo-400/35 via-purple-300/15 to-transparent",
    iconBg: "bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-800/50",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
];

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/payroll/api/employees")
      .then((res) => res.json())
      .then((data) => {
        if (data.total !== undefined) setEmployeeCount(data.total);
        else if (data.count !== undefined) setEmployeeCount(data.count);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#293381]/5 via-white to-[#36B4FF]/10 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#293381] text-white shadow-sm border border-[#293381] dark:bg-[#36B4FF] dark:text-[#293381] mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#36B4FF] dark:text-[#293381]" /> Enterprise HRMS Environment
            </div>
            <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight">
              Admin & HRMS Command Center
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Active identity: <span className="text-[#293381] dark:text-white font-semibold">{user?.name}</span> ({user?.email})
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span>Scope:</span>
            <span className="font-bold text-[#293381] dark:text-[#36B4FF]">{user?.widestScope || "ORGANIZATION"}</span>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Scoped Employees", value: employeeCount !== null ? employeeCount : "7", change: "Enforced via Turso DAL", icon: Users, color: "text-[#293381]" },
          { title: "Active Departments", value: "3", change: "Engineering, HR, Finance", icon: Building, color: "text-[#36B4FF]" },
          { title: "Today Attendance", value: "98.4%", change: "On Track", icon: CalendarCheck, color: "text-emerald-600" },
          { title: "Workforce Growth", value: "+14.2%", change: "Current Quarter", icon: TrendingUp, color: "text-[#293381]" },
        ].map((m) => (
          <div key={m.title} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">{m.title}</span>
              <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                <m.icon className={`w-4 h-4 ${m.color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#293381] dark:text-white">{m.value}</div>
            <div className="text-[11px] text-slate-400">{m.change}</div>
          </div>
        ))}
      </div>

      {/* Quick Links Navigation Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#36B4FF]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#293381] dark:text-slate-300">
              Quick Links
            </h2>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Fast navigation to administrative modules
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {ADMIN_QUICK_LINKS.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="group relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-card hover:border-[#36B4FF] hover:shadow-lg transition-all duration-300 flex flex-col justify-between min-h-[105px] sm:min-h-[110px] overflow-hidden"
            >
              {/* Top-Right Decorative Card Corner Color Gradient */}
              <div
                className={`absolute -top-6 -right-6 w-28 h-28 bg-gradient-to-bl ${link.cardGradient} rounded-full blur-xl pointer-events-none opacity-40 group-hover:opacity-75 group-hover:scale-125 transition-all duration-300`}
              />

              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  {/* Icon container with Title next to it */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${link.iconBg} border flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-sm`}
                      >
                        <link.icon className={`w-5 h-5 ${link.iconColor}`} />
                      </div>
                    </div>

                    <h3 className="font-bold text-sm sm:text-base text-[#293381] dark:text-white group-hover:text-[#36B4FF] transition truncate">
                      {link.name}
                    </h3>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#293381] dark:group-hover:text-[#36B4FF] transition-transform group-hover:translate-x-1 flex-shrink-0 ml-2" />
                </div>
              </div>

              <div className="relative z-10 mt-3 pt-2 sm:pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-medium text-slate-400 group-hover:text-[#293381] dark:group-hover:text-[#36B4FF] transition">
                <span>{link.tag}</span>
                <span className="font-semibold text-xs">Open →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
