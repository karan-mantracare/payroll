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
} from "lucide-react";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/payrol/api/employees")
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

      {/* 12 Admin Modules Navigation Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#293381] dark:text-slate-400">
          Admin Portal Modules (12 Modules)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { id: "1", name: "Dashboard", href: "/admin", desc: "Overall metrics, active alerts, and workforce KPIs" },
            { id: "2", name: "Employee Management", href: "/admin/employees", desc: "Directory, profile management, and hierarchy tree" },
            { id: "3", name: "Employee Lifecycle", href: "/admin/lifecycle", desc: "Onboarding, JML transitions, transfers, and exits" },
            { id: "4", name: "Attendance Management", href: "/admin/attendance", desc: "Clock-in/out records, timesheets, and biometric sync" },
            { id: "5", name: "Shift Management", href: "/admin/shifts", desc: "Shift rosters, rotational schedules, and overtime rules" },
            { id: "6", name: "Leave & Holidays", href: "/admin/leaves", desc: "Leave policies, holiday calendars, and approval queues" },
            { id: "7", name: "Training Management", href: "/admin/training", desc: "LMS courses, compliance certifications, and programs" },
            { id: "8", name: "Payroll Management", href: "/admin/payroll", desc: "Salary processing, statutory compliance, and tax slips" },
            { id: "9", name: "Approvals & Requests", href: "/admin/approvals", desc: "Multi-tier approval workflows and pending actions" },
            { id: "10", name: "Reports & Analytics", href: "/admin/reports", desc: "Workforce reports, export engines, and audit logs" },
            { id: "11", name: "Org Settings", href: "/admin/settings", desc: "Company entities, departments, locations, and roles" },
            { id: "12", name: "Access & Admin", href: "/admin/access", desc: "RBAC permissions, audit log chain, and session security" },
          ].map((mod) => (
            <Link
              key={mod.id}
              href={mod.href}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-card hover:border-[#36B4FF] hover:shadow-md transition group block"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="w-2 h-2 rounded-full bg-[#36B4FF]" />
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
