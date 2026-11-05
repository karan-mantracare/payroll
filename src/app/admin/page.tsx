"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import {
  Users,
  ShieldCheck,
  Building,
  TrendingUp,
  CreditCard,
  CalendarCheck,
  Clock,
  CheckCircle,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/payrol/api/employees")
      .then((res) => res.json())
      .then((data) => {
        if (data.count !== undefined) setEmployeeCount(data.count);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Programs Platform Environment
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Admin & HRMS Command Center
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Active identity: <span className="text-white font-medium">{user?.name}</span> ({user?.email})
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
            <span>Scope:</span>
            <span className="font-bold text-indigo-400">{user?.widestScope || "ORGANIZATION"}</span>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Scoped Employees", value: employeeCount !== null ? employeeCount : "7", change: "Enforced via Turso DAL", icon: Users, color: "text-indigo-400" },
          { title: "Active Departments", value: "3", change: "Engineering, HR, Finance", icon: Building, color: "text-blue-400" },
          { title: "Today Attendance", value: "98.4%", change: "On Track", icon: CalendarCheck, color: "text-emerald-400" },
          { title: "Payroll Status", value: "Draft", change: "Formulas Pending Phase 2", icon: CreditCard, color: "text-amber-400" },
        ].map((m) => (
          <div key={m.title} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">{m.title}</span>
              <m.icon className={`w-4 h-4 ${m.color}`} />
            </div>
            <div className="text-2xl font-bold text-white">{m.value}</div>
            <div className="text-[11px] text-slate-500">{m.change}</div>
          </div>
        ))}
      </div>

      {/* 12 Admin Modules Navigation Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Admin Portal Modules (12 Modules)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { id: "1", name: "Dashboard", href: "/admin", desc: "Overall metrics, active alerts, and workforce KPIs" },
            { id: "2", name: "Employee Management", href: "/admin/employees", desc: "Directory, profile management, and role assignments" },
            { id: "3", name: "Employee Lifecycle", href: "/admin/lifecycle", desc: "Onboarding, JML transitions, transfers, and exits" },
            { id: "4", name: "Attendance Management", href: "/admin/attendance", desc: "Real-time clock tracking, biometric integration, overrides" },
            { id: "5", name: "Shift Management", href: "/admin/shifts", desc: "Roster schedules, rotational shifts, swap requests" },
            { id: "6", name: "Leave & Holiday", href: "/admin/leaves", desc: "Leave quotas, holiday calendars, approval workflows" },
            { id: "7", name: "Training Management", href: "/admin/training", desc: "Compliance training, certification tracking, skill paths" },
            { id: "8", name: "Payroll Management", href: "/admin/payroll", desc: "Salary structures, deductions, payslip generation" },
            { id: "9", name: "Approvals & Requests", href: "/admin/approvals", desc: "Multi-level approval queues and manager escalations" },
            { id: "10", name: "Reports & Analytics", href: "/admin/reports", desc: "Headcount trends, attrition, and audit export reports" },
            { id: "11", name: "Organization Settings", href: "/admin/settings", desc: "Company entities, departments, locations, and policies" },
            { id: "12", name: "Access & Administration", href: "/admin/access", desc: "RBAC registry, permissions, and tamper-evident audit logs" },
          ].map((mod) => (
            <a
              key={mod.id}
              href={`/payrol${mod.href}`}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-850 transition flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-indigo-400">
                    Module {mod.id}
                  </span>
                </div>
                <h3 className="font-semibold text-white mt-1 group-hover:text-indigo-300 transition">
                  {mod.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1">{mod.desc}</p>
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-3 flex items-center justify-between">
                <span>Route: {mod.href}</span>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
