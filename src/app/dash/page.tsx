"use client";

import React from "react";
import { useAuth } from "@/components/AuthGate";
import {
  User,
  CalendarCheck2,
  Clock,
  CalendarDays,
  CreditCard,
  CheckCircle,
  Inbox,
  Sparkles,
} from "lucide-react";

export default function EmployeeDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Employee Self-Service Active
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Welcome, {user?.name}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Employee ID: <span className="font-mono text-indigo-400 font-semibold">{user?.employeeId || "EMP"}</span> • {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
            <span>Portal Scope:</span>
            <span className="font-bold text-emerald-400">{user?.widestScope || "SELF"}</span>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Shift Status", value: "09:00 - 18:00", note: "General Shift Today", icon: Clock, color: "text-indigo-400" },
          { title: "Monthly Attendance", value: "100%", note: "0 Late Marks", icon: CalendarCheck2, color: "text-emerald-400" },
          { title: "Leave Balance", value: "18 Days", note: "12 Privilege, 6 Casual", icon: CalendarDays, color: "text-blue-400" },
          { title: "Latest Payslip", value: "Oct 2026", note: "Disbursed", icon: CreditCard, color: "text-amber-400" },
        ].map((m) => (
          <div key={m.title} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">{m.title}</span>
              <m.icon className={`w-4 h-4 ${m.color}`} />
            </div>
            <div className="text-2xl font-bold text-white">{m.value}</div>
            <div className="text-[11px] text-slate-500">{m.note}</div>
          </div>
        ))}
      </div>

      {/* 11 Employee Modules Navigation */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Employee Portal Modules (11 Modules)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { id: "1", name: "My Dashboard", href: "/dash", desc: "Daily overview, active shift timer, and quick links" },
            { id: "2", name: "My Profile", href: "/dash/profile", desc: "Personal information, emergency contacts, documents" },
            { id: "3", name: "My Attendance", href: "/dash/attendance", desc: "Clock in/out history, regularizations, work hours" },
            { id: "4", name: "My Shifts", href: "/dash/shifts", desc: "Monthly schedule, upcoming shifts, swap requests" },
            { id: "5", name: "My Leaves", href: "/dash/leaves", desc: "Leave balances, apply for leaves, track approval status" },
            { id: "6", name: "My Payroll", href: "/dash/payroll", desc: "Payslips, tax deductions, compensation structure" },
            { id: "7", name: "Onboarding & JML", href: "/dash/onboarding", desc: "Onboarding checklist, policies acknowledgement, asset list" },
            { id: "8", name: "My Training", href: "/dash/training", desc: "Assigned courses, progress tracker, completion certificates" },
            { id: "9", name: "My Requests", href: "/dash/requests", desc: "Helpdesk tickets, equipment requisitions, letters" },
            { id: "10", name: "My Team", href: "/dash/team", desc: "Team directory, reporting lines (Team Manager / HR)", gated: true },
            { id: "11", name: "Team Approvals", href: "/dash/approvals", desc: "Approve subordinate leaves & shifts (Manager / HR)", gated: true },
          ].map((mod) => (
            <a
              key={mod.id}
              href={`/payrol${mod.href}`}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 transition flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    Module {mod.id}
                  </span>
                  {mod.gated && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-slate-800 text-amber-400 border border-amber-500/20">
                      Gated
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-white mt-1 group-hover:text-emerald-300 transition">
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

