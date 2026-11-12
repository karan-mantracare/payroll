"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CalendarCheck2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Send,
  Loader2,
  Coffee,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Info,
  Check,
  X,
  FileQuestion,
  Flag,
  Link2,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/components/AuthGate";

export default function EmployeeAttendancePage() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Today's punch status
  const [todayStatus, setTodayStatus] = useState<any>(null);

  // Monthly Records
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [monthlyRecords, setMonthlyRecords] = useState<any[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // Regularization modal state
  const [showRegModal, setShowRegModal] = useState(false);
  const [regDate, setRegDate] = useState(new Date().toISOString().split("T")[0]);
  const [regCheckIn, setRegCheckIn] = useState("09:00");
  const [regCheckOut, setRegCheckOut] = useState("18:00");
  const [regReason, setRegReason] = useState("");
  const [submittingReg, setSubmittingReg] = useState(false);
  const [regRequests, setRegRequests] = useState<any[]>([]);

  // Report Attendance modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [reportConflictWith, setReportConflictWith] = useState<"IN_TIME" | "OUT_TIME">("IN_TIME");
  const [reportYourValue, setReportYourValue] = useState("09:00");
  const [reportProofLink, setReportProofLink] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  // Keep live clock updated
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's status
  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/payroll/api/attendance/status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load status");
      setTodayStatus(data.status);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch monthly records
  const fetchMonthly = useCallback(async () => {
    try {
      setLoadingMonthly(true);
      const [year, month] = selectedMonth.split("-").map(Number);
      const start = `${selectedMonth}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;

      const res = await fetch(`/payroll/api/attendance?startDate=${start}&endDate=${end}`);
      const data = await res.json();
      if (res.ok && data.records) {
        setMonthlyRecords(data.records);
      }
    } catch (err: any) {
      console.error("Monthly fetch failed", err);
    } finally {
      setLoadingMonthly(false);
    }
  }, [selectedMonth]);

  // Fetch correction requests
  const fetchCorrections = useCallback(async () => {
    try {
      const res = await fetch("/payroll/api/attendance/corrections");
      const data = await res.json();
      if (res.ok && data.requests) {
        setRegRequests(data.requests);
      }
    } catch (err) {
      console.error("Corrections fetch failed", err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchMonthly();
    fetchCorrections();
  }, [fetchStatus, fetchMonthly, fetchCorrections]);

  // Handle Punch In
  const handleCheckIn = async () => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccessMsg(null);
      const res = await fetch("/payroll/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "WEB" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check-in failed");
      setSuccessMsg("Check-in recorded successfully!");
      await fetchStatus();
      await fetchMonthly();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Punch Out
  const handleCheckOut = async () => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccessMsg(null);
      const res = await fetch("/payroll/api/attendance/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "WEB" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check-out failed");
      setSuccessMsg("Check-out recorded successfully! Have a great evening.");
      await fetchStatus();
      await fetchMonthly();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Regularization Submit
  const handleRegularizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regReason.trim()) {
      setError("Please provide a reason for the regularization request.");
      return;
    }
    try {
      setSubmittingReg(true);
      setError(null);
      const res = await fetch("/payroll/api/attendance/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: regDate,
          requestedCheckIn: `${regDate}T${regCheckIn}:00Z`,
          requestedCheckOut: `${regDate}T${regCheckOut}:00Z`,
          reason: regReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setShowRegModal(false);
      setRegReason("");
      setSuccessMsg("Attendance regularization request submitted for HR review.");
      await fetchCorrections();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingReg(false);
    }
  };

  // Format UTC ISO to local HH:mm string
  const formatTime = (iso?: string | null) => {
    if (!iso) return "--:--";
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return "--:--";
    }
  };

  const localDateTimeToUtcIso = (dateStr: string, timeStr: string) => {
    const dt = new Date(`${dateStr}T${timeStr}:00`);
    return Number.isNaN(dt.getTime()) ? `${dateStr}T${timeStr}:00Z` : dt.toISOString();
  };

  const matchedReportRecord = monthlyRecords.find((r) => r.date === reportDate) || null;
  const currentReportValue =
    reportConflictWith === "IN_TIME"
      ? formatTime(matchedReportRecord?.checkInTimeUtc)
      : formatTime(matchedReportRecord?.checkOutTimeUtc);

  const openReportModal = (record?: any, defaultConflict: "IN_TIME" | "OUT_TIME" = "IN_TIME") => {
    const targetRecord = record || monthlyRecords[0] || null;
    const targetDate = targetRecord?.date || new Date().toISOString().split("T")[0];
    setReportDate(targetDate);
    setReportConflictWith(defaultConflict);
    setReportYourValue(defaultConflict === "IN_TIME" ? "09:00" : "18:00");
    setReportProofLink("");
    setReportReason("");
    setError(null);
    setShowReportModal(true);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportYourValue.trim()) {
      setError("Please enter Your Value for the conflicting time.");
      return;
    }
    if (!reportProofLink.trim()) {
      setError("Please provide a Link of Proof.");
      return;
    }

    try {
      setSubmittingReport(true);
      setError(null);

      const requestedCheckInUtc =
        reportConflictWith === "IN_TIME"
          ? localDateTimeToUtcIso(reportDate, reportYourValue)
          : matchedReportRecord?.checkInTimeUtc || localDateTimeToUtcIso(reportDate, "09:00");

      const requestedCheckOutUtc =
        reportConflictWith === "OUT_TIME"
          ? localDateTimeToUtcIso(reportDate, reportYourValue)
          : matchedReportRecord?.checkOutTimeUtc || localDateTimeToUtcIso(reportDate, "18:00");

      const res = await fetch("/payroll/api/attendance/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: reportDate,
          requestedCheckInUtc,
          requestedCheckOutUtc,
          conflictField: reportConflictWith,
          currentValue: currentReportValue,
          requestedValue: reportYourValue,
          proofLink: reportProofLink.trim(),
          reason: reportReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit attendance report.");

      setShowReportModal(false);
      setReportProofLink("");
      setReportReason("");
      setSuccessMsg("Attendance conflict report submitted for HR review.");
      await fetchCorrections();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingReport(false);
    }
  };

  // Calculate live worked duration if checked in
  const getElapsedDuration = () => {
    if (!todayStatus) return "0h 0m";
    if (todayStatus.isCheckedOut) {
      const mins = todayStatus.totalWorkMinutes || 0;
      return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    }
    if (todayStatus.isCheckedIn && todayStatus.checkInTimeUtc && currentTime) {
      const checkInDate = new Date(todayStatus.checkInTimeUtc);
      const diffMs = Math.max(0, currentTime.getTime() - checkInDate.getTime());
      const totalSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      return `${hours}h ${mins}m ${secs}s`;
    }
    return "0h 0m";
  };

  // Shift timings label
  const shiftLabel = todayStatus?.shift
    ? `${todayStatus.shift.name} (${todayStatus.shift.startTime} - ${todayStatus.shift.endTime})`
    : "No shift assigned";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#293381] tracking-tight flex items-center gap-2">
            <CalendarCheck2 className="w-6 h-6 text-[#36B4FF]" />
            My Attendance & Timesheet
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time punch in/out, shift status, timesheet history, and regularization requests.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => openReportModal()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition shadow-sm"
          >
            <Flag className="w-4 h-4 text-amber-600" />
            Report Attendance
          </button>
          <button
            onClick={() => setShowRegModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#36B4FF] text-[#293381] hover:bg-[#209ee8] transition shadow-sm"
          >
            <FileQuestion className="w-4 h-4" />
            Request Regularization
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero: Active Punch Clock Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-[#36B4FF]/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#36B4FF] animate-pulse" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Live Attendance Punch
                </span>
              </div>
              <span
                className={`text-xs px-3 py-1 rounded-full font-semibold border ${
                  todayStatus?.isCheckedIn
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : todayStatus?.isCheckedOut
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {todayStatus?.isCheckedIn
                  ? "PUNCHED IN"
                  : todayStatus?.isCheckedOut
                  ? "PUNCHED OUT (COMPLETED)"
                  : "NOT PUNCHED IN"}
              </span>
            </div>

            {/* Digital Clock & Date */}
            <div className="mt-6 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div>
                <p className="text-4xl sm:text-5xl font-mono font-bold text-[#293381] tracking-tight">
                  {currentTime
                    ? currentTime.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "--:--:--"}
                </p>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {currentTime
                    ? currentTime.toLocaleDateString(undefined, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "--"}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 sm:text-right">
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Elapsed Duration</p>
                <p className="text-xl font-bold font-mono text-[#293381] mt-0.5">
                  {getElapsedDuration()}
                </p>
              </div>
            </div>

            {/* Shift & Time Details */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Punch In</p>
                <p className="text-sm font-bold text-[#293381] mt-0.5">
                  {formatTime(todayStatus?.checkInTimeUtc)}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Punch Out</p>
                <p className="text-sm font-bold text-[#293381] mt-0.5">
                  {formatTime(todayStatus?.checkOutTimeUtc)}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Lateness</p>
                <p
                  className={`text-sm font-bold mt-0.5 ${
                    (todayStatus?.lateMinutes || 0) > 0 ? "text-amber-600" : "text-slate-600"
                  }`}
                >
                  {todayStatus?.lateMinutes ? `${todayStatus.lateMinutes} mins` : "On Time"}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Status</p>
                <p className="text-sm font-bold text-[#293381] mt-0.5">
                  {todayStatus?.status || "PENDING"}
                </p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-[#36B4FF]" />
              <span>Assigned Shift: <strong className="text-slate-700">{shiftLabel}</strong></span>
            </div>

            {loading ? (
              <button disabled className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-400 text-xs font-semibold">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Loading...
              </button>
            ) : !todayStatus?.isCheckedIn && !todayStatus?.isCheckedOut ? (
              <button
                onClick={handleCheckIn}
                disabled={actionLoading}
                className="px-8 py-3 rounded-xl bg-[#293381] hover:bg-[#1f2766] text-white text-xs font-bold transition shadow-md hover:shadow-lg flex items-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4 text-[#36B4FF]" />}
                PUNCH IN NOW
              </button>
            ) : todayStatus?.isCheckedIn && !todayStatus?.isCheckedOut ? (
              <button
                onClick={handleCheckOut}
                disabled={actionLoading}
                className="px-8 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md hover:shadow-lg flex items-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                PUNCH OUT (END DAY)
              </button>
            ) : (
              <div className="px-6 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                Completed for Today
              </div>
            )}
          </div>
        </div>

        {/* Regularization Requests Mini-Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-[#293381] flex items-center gap-2">
                <FileQuestion className="w-4 h-4 text-[#36B4FF]" />
                Recent Regularizations
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                {regRequests.length} total
              </span>
            </div>

            <div className="mt-4 space-y-3 max-h-72 overflow-y-auto">
              {regRequests.length === 0 ? (
                <div className="p-8 text-center space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">No pending requests</p>
                  <p className="text-[11px] text-slate-400">All attendance records are synchronized.</p>
                </div>
              ) : (
                regRequests.slice(0, 5).map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/60 transition text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{req.requestedDate || req.date}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          req.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : req.status === "REJECTED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    {req.conflictField && (
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-amber-700">
                        <span>
                          {req.conflictField === "IN_TIME" ? "In Time" : "Out Time"}: {req.currentValue || "--:--"} → {req.requestedValue || "--:--"}
                        </span>
                        {req.proofLink && (
                          <a
                            href={req.proofLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[#293381] hover:underline"
                          >
                            Proof <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    )}
                    <p className="text-slate-500 text-[11px] truncate">
                      {req.reason}
                    </p>
                    {req.reviewNotes && (
                      <p className="text-[10px] text-slate-400 italic">
                        Note: {req.reviewNotes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => setShowRegModal(true)}
            className="w-full mt-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-[#293381] transition text-center"
          >
            + New Regularization Request
          </button>
        </div>
      </div>

      {/* Monthly Attendance Records Grid / Ledger */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-[#293381]">Monthly Attendance Ledger</h3>
            <p className="text-xs text-slate-500">Summary of all daily punch timestamps and hours worked.</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Select Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-[#293381] focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
            />
          </div>
        </div>

        {/* Quick Month Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Days Recorded</p>
            <p className="text-lg font-bold text-[#293381] mt-0.5">{monthlyRecords.length}</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Present Days</p>
            <p className="text-lg font-bold text-emerald-600 mt-0.5">
              {monthlyRecords.filter((r) => r.status === "PRESENT" || r.status === "LATE").length}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Late Arrivals</p>
            <p className="text-lg font-bold text-amber-600 mt-0.5">
              {monthlyRecords.filter((r) => r.status === "LATE" || (r.lateMinutes || 0) > 0).length}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Total Hours</p>
            <p className="text-lg font-bold text-[#36B4FF] mt-0.5">
              {(
                monthlyRecords.reduce((acc, r) => acc + (r.totalWorkMinutes || 0), 0) / 60
              ).toFixed(1)}{" "}
              hrs
            </p>
          </div>
        </div>

        {/* Ledger Table */}
        {loadingMonthly ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#293381] mx-auto" />
            <p className="text-xs text-slate-400 mt-2">Loading month records...</p>
          </div>
        ) : monthlyRecords.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No attendance entries logged for this month.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Shift</th>
                  <th className="px-4 py-3">Check In</th>
                  <th className="px-4 py-3">Check Out</th>
                  <th className="px-4 py-3">Work Hours</th>
                  <th className="px-4 py-3">Lateness</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlyRecords.map((rec) => {
                  const hours = Math.floor((rec.totalWorkMinutes || 0) / 60);
                  const mins = (rec.totalWorkMinutes || 0) % 60;
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-semibold text-[#293381]">{rec.date}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {rec.shiftName || "General Shift"}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-800">
                        {formatTime(rec.checkInTimeUtc)}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-800">
                        <div>{formatTime(rec.checkOutTimeUtc)}</div>
                        {(rec.source === "AUTO_CHECKOUT" || rec.notes?.includes("Auto-checked out")) && (
                          <span className="inline-block mt-0.5 text-[10px] font-sans font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                            Auto (Shift End)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {rec.totalWorkMinutes ? `${hours}h ${mins}m` : "--"}
                      </td>
                      <td className="px-4 py-3">
                        {rec.lateMinutes > 0 ? (
                          <span className="text-amber-600 font-semibold">{rec.lateMinutes}m late</span>
                        ) : (
                          <span className="text-slate-400">On time</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            rec.status === "PRESENT"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : rec.status === "LATE"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : rec.status === "HALF_DAY"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : rec.status === "ABSENT"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-flex items-center justify-end group">
                          <button
                            type="button"
                            onClick={() => openReportModal(rec, rec.checkOutTimeUtc ? "OUT_TIME" : "IN_TIME")}
                            aria-label="Report Attendance"
                            title="Report Attendance"
                            data-testid={`report-attendance-icon-${rec.date}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition focus:outline-none focus:ring-2 focus:ring-amber-400"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                          <div
                            role="tooltip"
                            className="pointer-events-none absolute bottom-full right-0 mb-1.5 px-2.5 py-1 rounded-md bg-[#293381] text-white text-[11px] font-semibold whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 z-30"
                          >
                            Report Attendance
                            <span className="absolute top-full right-3 border-4 border-transparent border-t-[#293381]" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Regularization Modal */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-[#293381] text-base flex items-center gap-2">
                <FileQuestion className="w-5 h-5 text-[#36B4FF]" />
                Request Attendance Regularization
              </h3>
              <button
                onClick={() => setShowRegModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegularizeSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Date to Regularize</label>
                <input
                  type="date"
                  value={regDate}
                  onChange={(e) => setRegDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Requested Check In</label>
                  <input
                    type="time"
                    value={regCheckIn}
                    onChange={(e) => setRegCheckIn(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Requested Check Out</label>
                  <input
                    type="time"
                    value={regCheckOut}
                    onChange={(e) => setRegCheckOut(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason for Regularization</label>
                <textarea
                  value={regReason}
                  onChange={(e) => setRegReason(e.target.value)}
                  placeholder="Explain why punch was missed (e.g., biometric machine offline, client visit, network issue)..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRegModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReg}
                  className="px-5 py-2 rounded-lg bg-[#293381] hover:bg-[#1f2766] text-white font-bold flex items-center gap-2"
                >
                  {submittingReg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Attendance Popup Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-[#293381] text-base flex items-center gap-2">
                <Flag className="w-5 h-5 text-amber-600" />
                Report Attendance
              </h3>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReportSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Attendance Date</label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Conflict With</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReportConflictWith("IN_TIME");
                      setReportYourValue("09:00");
                    }}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition ${
                      reportConflictWith === "IN_TIME"
                        ? "bg-[#293381] text-white border-[#293381] shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    In Time
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportConflictWith("OUT_TIME");
                      setReportYourValue("18:00");
                    }}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition ${
                      reportConflictWith === "OUT_TIME"
                        ? "bg-[#293381] text-white border-[#293381] shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Out Time
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Current Value</label>
                  <input
                    type="text"
                    readOnly
                    value={currentReportValue}
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-100 text-slate-600 rounded-lg text-xs font-mono font-semibold cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Your Value</label>
                  <input
                    type="time"
                    value={reportYourValue}
                    onChange={(e) => setReportYourValue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Link of Proof</label>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={reportProofLink}
                    onChange={(e) => setReportProofLink(e.target.value)}
                    placeholder="https://drive.google.com/... or screenshot URL"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Reason / Explanation <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Explain why there is a conflict (e.g., biometric machine missed punch, field visit, manager approved remote check-in)..."
                  data-testid="report-attendance-reason"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="px-5 py-2 rounded-lg bg-[#293381] hover:bg-[#1f2766] text-white font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {submittingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
