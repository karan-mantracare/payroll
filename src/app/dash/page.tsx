"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthGate";
import Link from "next/link";
import {
  CalendarCheck2,
  Clock,
  CalendarDays,
  CreditCard,
  GraduationCap,
  Inbox,
  Users,
  Sparkles,
  ArrowRight,
  MapPin,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  Calendar as CalendarIcon,
  ShieldCheck,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface QuickLinkItem {
  name: string;
  href: string;
  desc: string;
  tag: string;
  icon: React.ComponentType<{ className?: string }>;
}

const QUICK_LINKS: QuickLinkItem[] = [
  {
    name: "My Attendance",
    href: "/dash/attendance",
    desc: "Daily check-in/out logs, shift hours & timesheet history",
    tag: "Attendance & Shifts",
    icon: CalendarCheck2,
  },
  {
    name: "My Payroll",
    href: "/dash/payroll",
    desc: "Monthly payslips, salary breakdowns & tax declarations",
    tag: "Finance & Payslips",
    icon: CreditCard,
  },
  {
    name: "My Leaves",
    href: "/dash/leaves",
    desc: "Apply for leaves, view balance quotas & public holidays",
    tag: "Leave Management",
    icon: CalendarDays,
  },
  {
    name: "My Training",
    href: "/dash/training",
    desc: "Assigned compliance modules, courses & certificates",
    tag: "Learning & Growth",
    icon: GraduationCap,
  },
  {
    name: "My Requests",
    href: "/dash/requests",
    desc: "Track status of submitted HR, IT & administrative requests",
    tag: "Helpdesk & Requests",
    icon: Inbox,
  },
  {
    name: "My Team",
    href: "/dash/team",
    desc: "Direct reports, peers directory & reporting hierarchy",
    tag: "Organization & Directory",
    icon: Users,
  },
];

export default function EmployeeDashboardPage() {
  const { user } = useAuth();

  // Live Digital Clock & Date
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Punch Status & Loading
  const [punchStatus, setPunchStatus] = useState<any>(null);
  const [punchLoading, setPunchLoading] = useState(false);
  const [punchMessage, setPunchMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch Attendance Status
  const fetchPunchStatus = useCallback(async () => {
    try {
      const res = await fetch("/payrol/api/attendance/status");
      if (res.ok) {
        const data = await res.json();
        setPunchStatus(data.status);
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  useEffect(() => {
    fetchPunchStatus();
  }, [fetchPunchStatus]);

  // Handle Punch In / Punch Out
  const handlePunchAction = async () => {
    try {
      setPunchLoading(true);
      setPunchMessage(null);

      const isPunchingOut = Boolean(punchStatus?.isCheckedIn);
      const endpoint = isPunchingOut
        ? "/payrol/api/attendance/check-out"
        : "/payrol/api/attendance/check-in";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "WEB" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Punch action could not be recorded.");
      }

      setPunchMessage({
        type: "success",
        text: isPunchingOut
          ? "Punch out recorded successfully! Have a great evening."
          : "Punch in recorded successfully! Have a productive day.",
      });

      await fetchPunchStatus();
    } catch (err: any) {
      setPunchMessage({
        type: "error",
        text: err.message || "Failed to process punch action.",
      });
    } finally {
      setPunchLoading(false);
    }
  };

  // Helper formatters
  const formatTime = (iso?: string | null) => {
    if (!iso) return "--:--";
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "--:--";
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#293381]/5 via-white to-[#36B4FF]/10 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#293381] text-white shadow-sm border border-[#293381] dark:bg-[#36B4FF] dark:text-[#293381] mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#36B4FF] dark:text-[#293381]" /> Employee Self-Service Active
            </div>
            <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight">
              Welcome, {user?.name}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Employee Code:{" "}
              <span className="font-mono text-[#293381] dark:text-[#36B4FF] font-semibold">
                {user?.employeeId || "EMP"}
              </span>{" "}
              • {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span>Scope:</span>
            <span className="font-bold text-[#293381] dark:text-[#36B4FF]">
              {user?.widestScope || "SELF"}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Shift Schedule",
            value: "09:00 - 18:00",
            note: "General Shift Today",
            icon: Clock,
            color: "text-[#293381]",
          },
          {
            title: "Monthly Attendance",
            value: "100%",
            note: "0 Late Marks",
            icon: CalendarCheck2,
            color: "text-[#36B4FF]",
          },
          {
            title: "Leave Balance",
            value: "18 Days",
            note: "12 Privilege, 6 Casual",
            icon: CalendarDays,
            color: "text-[#293381]",
          },
          {
            title: "Latest Payslip",
            value: "Oct 2026",
            note: "Disbursed On Time",
            icon: CreditCard,
            color: "text-[#36B4FF]",
          },
        ].map((m) => (
          <div
            key={m.title}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-card space-y-2"
          >
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

      {/* Main Split: 75% Quick Links (3x3 grid) | 25% Punch Now Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 75% AREA: Quick Links in 3x3 Grid */}
        <div className="lg:col-span-9 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#36B4FF]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#293381] dark:text-slate-300">
                Quick Links
              </h2>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Fast navigation to employee self-service modules
            </span>
          </div>

          {/* 3x3 Grid for Quick Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-card hover:border-[#36B4FF] hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[145px]"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center text-[#293381] dark:text-[#36B4FF] group-hover:scale-105 group-hover:bg-[#293381] group-hover:text-white transition duration-200">
                      <link.icon className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#293381] dark:group-hover:text-[#36B4FF] transition-transform group-hover:translate-x-1" />
                  </div>
                  <h3 className="font-bold text-sm text-[#293381] dark:text-white group-hover:text-[#36B4FF] transition">
                    {link.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {link.desc}
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-medium text-slate-400 group-hover:text-[#293381] dark:group-hover:text-[#36B4FF] transition">
                  <span>{link.tag}</span>
                  <span className="font-semibold text-xs">Open →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 25% AREA: Punch Now Widget */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#293381] dark:text-slate-300">
                Punch Now
              </h2>
            </div>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                punchStatus?.isCheckedIn
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                  : punchStatus?.isCheckedOut
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              }`}
            >
              {punchStatus?.isCheckedIn
                ? "Punched In"
                : punchStatus?.isCheckedOut
                ? "Completed"
                : "Not Punched"}
            </span>
          </div>

          {/* Widget Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-card space-y-4 relative overflow-hidden">
            {/* Top decorative gradient glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#36B4FF]/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

            {/* Live Clock Display */}
            <div>
              <div className="text-2xl sm:text-3xl font-mono font-bold text-[#293381] dark:text-white tracking-tight">
                {currentTime
                  ? currentTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "--:--:--"}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {currentTime
                    ? currentTime.toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "--"}
                </span>
              </div>
            </div>

            {/* Location Display */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                <span>Delhi HQ — Main Campus</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pl-5">
                <span>Office Wi-Fi • Geofence OK</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Verified</span>
              </div>
            </div>

            {/* Punch In / Out Timestamp Info */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">In</span>
                <span className="font-mono font-bold text-[#293381] dark:text-white">
                  {formatTime(punchStatus?.checkInTimeUtc)}
                </span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Out</span>
                <span className="font-mono font-bold text-[#293381] dark:text-white">
                  {formatTime(punchStatus?.checkOutTimeUtc)}
                </span>
              </div>
            </div>

            {/* Notification alert if any */}
            {punchMessage && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                  punchMessage.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                }`}
              >
                {punchMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                )}
                <span>{punchMessage.text}</span>
              </div>
            )}

            {/* Punch Now Action Button */}
            <div>
              {punchStatus?.isCheckedIn ? (
                <button
                  type="button"
                  onClick={handlePunchAction}
                  disabled={punchLoading}
                  className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {punchLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <LogOut className="w-4 h-4 text-white" />
                  )}
                  <span>{punchLoading ? "Recording..." : "Punch Out"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePunchAction}
                  disabled={punchLoading || punchStatus?.isCheckedOut}
                  className="w-full py-2.5 px-3 bg-[#293381] hover:bg-[#1F2664] active:scale-[0.98] text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {punchLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#36B4FF]" />
                  ) : (
                    <Fingerprint className="w-4 h-4 text-[#36B4FF]" />
                  )}
                  <span>
                    {punchLoading
                      ? "Recording..."
                      : punchStatus?.isCheckedOut
                      ? "Day Completed"
                      : "Punch In Now"}
                  </span>
                </button>
              )}
            </div>

            {/* Footer Quick Link to full timesheet */}
            <div className="pt-1 text-center">
              <Link
                href="/dash/attendance"
                className="text-[11px] font-semibold text-[#293381] dark:text-[#36B4FF] hover:underline inline-flex items-center gap-1"
              >
                <span>View Full Attendance Timesheet</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
