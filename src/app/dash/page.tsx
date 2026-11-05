"use client";

import React from "react";
import { useAuth } from "@/components/AuthGate";
import Link from "next/link";
import {
  User,
  CalendarCheck2,
  Clock,
  CalendarDays,
  CreditCard,
  CheckCircle,
  Inbox,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default function EmployeeDashboardPage() {
  const { user, hasPermission } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#293381]/5 via-white to-[#36B4FF]/10 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#293381]/10 text-[#293381] dark:text-[#36B4FF] border border-[#293381]/20 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#36B4FF]" /> Employee Self-Service Active
            </div>
            <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight">
              Welcome, {user?.name}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Employee Code: <span className="font-mono text-[#293381] dark:text-[#36B4FF] font-semibold">{user?.employeeId || "EMP"}</span> • {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span>Scope:</span>
            <span className="font-bold text-[#293381] dark:text-[#36B4FF]">{user?.widestScope || "SELF"}</span>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Shift Schedule", value: "09:00 - 18:00", note: "General Shift Today", icon: Clock, color: "text-[#293381]" },
          { title: "Monthly Attendance", value: "100%", note: "0 Late Marks", icon: CalendarCheck2, color: "text-[#36B4FF]" },
          { title: "Leave Balance", value: "18 Days", note: "12 Privilege, 6 Casual", icon: CalendarDays, color: "text-[#293381]" },
          { title: "Latest Payslip", value: "Oct 2026", note: "Disbursed On Time", icon: CreditCard, color: "text-[#36B4FF]" },
        ].map((m) => (
          <div key={m.title} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">{m.title}</span>
              <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                <m.icon className={`w-4 h-4 ${m.color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#293381] dark:text-white">{m.value}</div>
            <div className="text-[11px] text-slate-400">{m.note}</div>
          </div>
        ))}
      </div>

      {/* Self-Service Modules Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#293381] dark:text-slate-400">
          My Workspace Modules (11 Modules)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { id: "1", name: "My Dashboard", href: "/dash", desc: "Overview of shifts, leaves, and notifications" },
            { id: "2", name: "My Profile", href: "/dash/profile", desc: "Personal identity, contacts, and employment history" },
            { id: "3", name: "My Attendance", href: "/dash/attendance", desc: "Daily check-in/out, logs, and regularization" },
            { id: "4", name: "My Shifts", href: "/dash/shifts", desc: "Upcoming shift schedule and roster calendar" },
            { id: "5", name: "My Leaves", href: "/dash/leaves", desc: "Apply for leaves, view balances and holiday lists" },
            { id: "6", name: "My Payroll", href: "/dash/payroll", desc: "Download monthly payslips and tax declarations" },
            { id: "7", name: "Onboarding & JML", href: "/dash/onboarding", desc: "Checklist, tasks, document uploads, and policies" },
            { id: "8", name: "My Training", href: "/dash/training", desc: "Assigned courses and compliance certificates" },
            { id: "9", name: "My Requests", href: "/dash/requests", desc: "Track status of submitted HR service requests" },
            {
              id: "10",
              name: "My Team",
              href: "/dash/team",
              desc: "Direct reports, peers, and reporting line hierarchy",
              managerOnly: true,
            },
            {
              id: "11",
              name: "Team Approvals",
              href: "/dash/approvals",
              desc: "Manager approvals for team leaves and requests",
              managerOnly: true,
            },
          ].map((mod) => (
            <Link
              key={mod.id}
              href={mod.href}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-card hover:border-[#36B4FF] hover:shadow-md transition group block"
            >
              <div className="flex items-center justify-between mb-3">
                {mod.managerOnly ? (
                  <span className="text-[10px] font-bold text-[#293381] bg-[#293381]/10 px-2 py-0.5 rounded border border-[#293381]/20">
                    Manager
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-[#36B4FF]" />
                )}
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#293381] dark:group-hover:text-[#36B4FF] transition-transform group-hover:translate-x-1" />
              </div>
              <h3 className="font-bold text-sm text-[#293381] dark:text-white group-hover:text-[#36B4FF] transition">
                {mod.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{mod.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
