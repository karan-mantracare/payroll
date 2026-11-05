"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CalendarCheck2,
  Clock,
  UserCheck,
  AlertTriangle,
  FileCheck,
  Filter,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Edit,
  Building,
  User,
  Shield,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/components/AuthGate";

export default function AdminAttendancePage() {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [statusFilter, setStatusFilter] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    late: 0,
    halfDay: 0,
    pendingCorrections: 0,
  });

  // Regularization Requests Drawer / Modal
  const [showCorrections, setShowCorrections] = useState(false);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loadingCorrections, setLoadingCorrections] = useState(false);

  // Manual Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    employeeId: "",
    date: new Date().toISOString().split("T")[0],
    checkInTime: "09:00",
    checkOutTime: "18:00",
    status: "PRESENT",
    notes: "",
  });
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (date) q.set("date", date);
      if (statusFilter) q.set("status", statusFilter);

      const res = await fetch(`/payrol/api/attendance?${q.toString()}`);
      if (!res.ok) throw new Error("Failed to load attendance");
      const data = await res.json();
      const list = data.records || [];
      setRecords(list);

      // Compute statistics
      const presentCount = list.filter((r: any) => r.status === "PRESENT").length;
      const lateCount = list.filter((r: any) => r.status === "LATE").length;
      const halfDayCount = list.filter((r: any) => r.status === "HALF_DAY").length;

      setStats((prev) => ({
        ...prev,
        total: list.length,
        present: presentCount,
        late: lateCount,
        halfDay: halfDayCount,
      }));
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, [date, statusFilter]);

  const fetchCorrections = useCallback(async () => {
    setLoadingCorrections(true);
    try {
      const res = await fetch("/payrol/api/attendance/corrections");
      if (res.ok) {
        const data = await res.json();
        const list = data.requests || [];
        setCorrections(list);
        setStats((prev) => ({
          ...prev,
          pendingCorrections: list.filter((c: any) => c.status === "PENDING").length,
        }));
      }
    } catch {
      // fallback
    } finally {
      setLoadingCorrections(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
    fetchCorrections();
  }, [fetchAttendance, fetchCorrections]);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjusting(true);
    setAdjustError(null);

    try {
      const checkInUtc = `${adjustForm.date}T${adjustForm.checkInTime}:00.000Z`;
      const checkOutUtc = `${adjustForm.date}T${adjustForm.checkOutTime}:00.000Z`;

      const res = await fetch("/payrol/api/attendance/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: adjustForm.employeeId,
          date: adjustForm.date,
          checkInTimeUtc: checkInUtc,
          checkOutTimeUtc: checkOutUtc,
          status: adjustForm.status,
          notes: adjustForm.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to adjust attendance");

      setShowAdjustModal(false);
      setAdjustForm({
        employeeId: "",
        date: new Date().toISOString().split("T")[0],
        checkInTime: "09:00",
        checkOutTime: "18:00",
        status: "PRESENT",
        notes: "",
      });
      await fetchAttendance();
    } catch (err: any) {
      setAdjustError(err.message);
    } finally {
      setAdjusting(false);
    }
  };

  const handleReviewCorrection = async (requestId: string, decision: "APPROVED" | "REJECTED") => {
    let rejectionReason: string | undefined = undefined;
    if (decision === "REJECTED") {
      const promptRes = prompt("Enter reason for rejection:");
      if (!promptRes) return;
      rejectionReason = promptRes;
    }

    try {
      const res = await fetch(`/payrol/api/attendance/corrections/${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: decision,
          rejectionReason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to review correction");
      }

      await fetchCorrections();
      await fetchAttendance();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PRESENT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Present
          </span>
        );
      case "LATE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Late Arrival
          </span>
        );
      case "HALF_DAY":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 text-blue-600" /> Half Day
          </span>
        );
      case "ABSENT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Absent
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const formatUtcTime = (isoStr?: string | null) => {
    if (!isoStr) return "--:--";
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
            <CalendarCheck2 className="w-6 h-6 text-[#36B4FF]" />
            Attendance Command Center & Live Roster
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time daily workforce check-ins, lateness calculations, regularization requests, and manual adjustments. Active scope:{" "}
            <span className="font-mono font-semibold text-[#293381] dark:text-[#36B4FF]">
              {user?.widestScope}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setShowCorrections(true)}
            className="relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-semibold text-xs transition shadow-sm"
          >
            <FileCheck className="w-4 h-4 text-[#36B4FF]" />
            Regularization Requests
            {stats.pendingCorrections > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold ml-1">
                {stats.pendingCorrections}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowAdjustModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white font-semibold text-xs transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Manual Adjustment
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Total Scoped Records</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Workforce roster for date</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 block mb-1">Present On Time</span>
          <div className="text-2xl font-bold text-emerald-600">{stats.present}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Full-day shifts completed</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 block mb-1">Late Arrivals</span>
          <div className="text-2xl font-bold text-amber-600">{stats.late}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Exceeded 15m grace window</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-blue-600 block mb-1">Half-Day & Early Exits</span>
          <div className="text-2xl font-bold text-blue-600">{stats.halfDay}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Worked &lt; 4 hours</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
          >
            <option value="">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="HALF_DAY">Half Day</option>
            <option value="ABSENT">Absent</option>
          </select>
        </div>

        <button
          onClick={() => fetchAttendance()}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 transition self-end sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Roster Table */}
      {loading ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin text-[#293381] mx-auto" />
          <p className="text-xs text-slate-400 mt-2">Loading attendance records...</p>
        </div>
      ) : records.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <CalendarCheck2 className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No records found</p>
          <p className="text-xs text-slate-400">
            No attendance entries recorded for {date}. Employees can check in from the Employee Portal.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Assigned Shift</th>
                  <th className="px-4 py-3">Check-In</th>
                  <th className="px-4 py-3">Check-Out</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white text-xs">{r.employeeName}</div>
                      <div className="font-mono text-[11px] text-[#36B4FF]">{r.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {r.departmentName || "Engineering"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <div className="font-semibold text-xs">{r.shiftName || "General Shift"}</div>
                      <div className="font-mono text-[10px] text-slate-400">
                        {r.shiftStartTime || "09:00"} - {r.shiftEndTime || "18:00"}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <div>{formatUtcTime(r.checkInTimeUtc)}</div>
                      {r.lateMinutes > 0 && (
                        <span className="text-[10px] text-amber-600 font-sans font-semibold">
                          +{r.lateMinutes}m late
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <div>{formatUtcTime(r.checkOutTimeUtc)}</div>
                      {r.earlyExitMinutes > 0 && (
                        <span className="text-[10px] text-rose-500 font-sans font-semibold">
                          -{r.earlyExitMinutes}m early
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-white">
                      {r.totalWorkMinutes > 0 ? formatHours(r.totalWorkMinutes) : "--"}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(r.status)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {r.source}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Regularization Requests Modal */}
      {showCorrections && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-[#293381] dark:text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#36B4FF]" />
                Pending Regularization & Correction Requests
              </h3>
              <button
                onClick={() => setShowCorrections(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {loadingCorrections ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#293381] mx-auto" />
                </div>
              ) : corrections.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No pending correction requests.
                </div>
              ) : (
                corrections.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white mr-2">
                          {c.employeeName}
                        </span>
                        <span className="font-mono text-[#36B4FF]">({c.employeeCode})</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">Date: {c.requestedDate}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300 font-mono bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div>Check-In: {formatUtcTime(c.requestedCheckInUtc)}</div>
                      <div>Check-Out: {formatUtcTime(c.requestedCheckOutUtc)}</div>
                    </div>

                    <div className="text-slate-600 dark:text-slate-400 italic">
                      Reason: &quot;{c.reason}&quot;
                    </div>

                    {c.status === "PENDING" ? (
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => handleReviewCorrection(c.id, "REJECTED")}
                          className="px-3 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold transition"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleReviewCorrection(c.id, "APPROVED")}
                          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-sm"
                        >
                          Approve Regularization
                        </button>
                      </div>
                    ) : (
                      <div className="text-right">
                        <span className="font-semibold text-slate-500 uppercase">{c.status}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#293381] dark:text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-[#36B4FF]" />
              HR Manual Attendance Adjustment
            </h3>

            {adjustError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Employee ID or Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EMP-004"
                  value={adjustForm.employeeId}
                  onChange={(e) => setAdjustForm({ ...adjustForm, employeeId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={adjustForm.date}
                  onChange={(e) => setAdjustForm({ ...adjustForm, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Check-In Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={adjustForm.checkInTime}
                    onChange={(e) => setAdjustForm({ ...adjustForm, checkInTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Check-Out Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={adjustForm.checkOutTime}
                    onChange={(e) => setAdjustForm({ ...adjustForm, checkOutTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={adjustForm.status}
                  onChange={(e) => setAdjustForm({ ...adjustForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                >
                  <option value="PRESENT">Present (Full Day)</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="LATE">Late Arrival</option>
                  <option value="ON_LEAVE">On Leave</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason / Notes *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Mandatory reason for audit record..."
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                >
                  {adjusting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
