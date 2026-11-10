"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthGate";
import Link from "next/link";
import {
  CalendarCheck2,
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
  tag: string;
  icon: React.ComponentType<{ className?: string }>;
  cardGradient: string;
  iconBg: string;
  iconColor: string;
}

const QUICK_LINKS: QuickLinkItem[] = [
  {
    name: "My Attendance",
    href: "/dash/attendance",
    tag: "Attendance & Shifts",
    icon: CalendarCheck2,
    cardGradient: "from-emerald-400/35 via-teal-300/15 to-transparent",
    iconBg: "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-800/50",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    name: "My Payroll",
    href: "/dash/payroll",
    tag: "Finance & Payslips",
    icon: CreditCard,
    cardGradient: "from-[#36B4FF]/40 via-[#293381]/25 to-transparent",
    iconBg: "bg-blue-50/80 dark:bg-blue-950/30 border-blue-100 dark:border-blue-800/50",
    iconColor: "text-[#293381] dark:text-[#36B4FF]",
  },
  {
    name: "My Leaves",
    href: "/dash/leaves",
    tag: "Leave Management",
    icon: CalendarDays,
    cardGradient: "from-amber-400/35 via-orange-300/15 to-transparent",
    iconBg: "bg-amber-50/80 dark:bg-amber-950/30 border-amber-100 dark:border-amber-800/50",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    name: "My Training",
    href: "/dash/training",
    tag: "Learning & Growth",
    icon: GraduationCap,
    cardGradient: "from-indigo-400/35 via-purple-300/15 to-transparent",
    iconBg: "bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-800/50",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    name: "My Requests",
    href: "/dash/requests",
    tag: "Helpdesk & Requests",
    icon: Inbox,
    cardGradient: "from-rose-400/35 via-pink-300/15 to-transparent",
    iconBg: "bg-rose-50/80 dark:bg-rose-950/30 border-rose-100 dark:border-rose-800/50",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  {
    name: "My Team",
    href: "/dash/team",
    tag: "Organization & Directory",
    icon: Users,
    cardGradient: "from-cyan-400/35 via-sky-300/15 to-transparent",
    iconBg: "bg-cyan-50/80 dark:bg-cyan-950/30 border-cyan-100 dark:border-cyan-800/50",
    iconColor: "text-cyan-600 dark:text-cyan-400",
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
      {/* 1. Welcome Banner */}
      <div className="bg-gradient-to-r from-[#293381]/5 via-white to-[#36B4FF]/10 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#293381] text-white shadow-sm border border-[#293381] dark:bg-[#36B4FF] dark:text-[#293381] mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#36B4FF] dark:text-[#293381]" /> Employee Self-Service Active
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#293381] dark:text-white tracking-tight">
              Welcome, {user?.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Employee Code:{" "}
              <span className="font-mono text-[#293381] dark:text-[#36B4FF] font-semibold">
                {user?.employeeId || "EMP"}
              </span>{" "}
              • {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm self-start sm:self-auto">
            <span>Scope:</span>
            <span className="font-bold text-[#293381] dark:text-[#36B4FF]">
              {user?.widestScope || "SELF"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Layout: 25% Punch In on the Left | 75% Metrics & Quick Links on the Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: 25% (lg:col-span-3) -> Punch Now Widget */}
        <div className="lg:col-span-3 space-y-3 w-full">
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

          {/* Widget Card: Elevated with prominent drop shadow and accent border */}
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-5 shadow-2xl shadow-[#293381]/15 dark:shadow-black/70 ring-1 ring-slate-900/5 space-y-4 relative overflow-hidden transition-all duration-200 hover:shadow-[0_20px_50px_rgba(41,51,129,0.22)]">
            {/* Top accent highlight bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#293381] via-[#36B4FF] to-[#293381]" />

            {/* Top decorative gradient glow */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-[#36B4FF]/15 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

            {/* Live Clock Display */}
            <div className="pt-1">
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
                  className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
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
                  className="w-full py-2.5 px-3 bg-[#293381] hover:bg-[#1F2664] active:scale-[0.98] text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
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

        {/* RIGHT COLUMN: 75% (lg:col-span-9) -> Quick Metrics (Top) & Quick Links (Bottom) */}
        <div className="lg:col-span-9 space-y-6 w-full">
          {/* Quick Metrics: 3 tiles spanning the 75% container */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            {[
              {
                mobileTitle: "Attendance",
                title: "Monthly Attendance",
                value: "100%",
                note: "0 Late Marks",
                icon: CalendarCheck2,
                color: "text-[#36B4FF]",
              },
              {
                mobileTitle: "Leaves",
                title: "Leave Balance",
                value: "18 Days",
                note: "12 Privilege, 6 Casual",
                icon: CalendarDays,
                color: "text-[#293381]",
              },
              {
                mobileTitle: "Payslip",
                title: "Latest Payslip",
                value: "Oct 2026",
                note: "Disbursed On Time",
                icon: CreditCard,
                color: "text-[#36B4FF]",
              },
            ].map((m) => (
              <div
                key={m.title}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-5 shadow-card space-y-1 sm:space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-500">
                    <span className="sm:hidden">{m.mobileTitle}</span>
                    <span className="hidden sm:inline">{m.title}</span>
                  </span>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <m.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${m.color}`} />
                  </div>
                </div>
                <div className="text-base sm:text-2xl font-bold text-[#293381] dark:text-white">{m.value}</div>
                <div className="text-[9px] sm:text-[11px] text-slate-400 truncate">{m.note}</div>
              </div>
            ))}
          </div>

          {/* Quick Links Section: 3x3 Grid directly under the 3 metrics */}
          <div className="space-y-3">
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

            {/* 3x3 Grid for Quick Links (Clean, Title next to Icon) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4">
              {QUICK_LINKS.map((link) => (
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
      </div>
    </div>
  );
}
