"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Calendar,
  Coffee,
  ShieldCheck,
  Moon,
  Sun,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  CalendarRange,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthGate";

const DAYS_OF_WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_FULL_NAMES: Record<string, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

export default function EmployeeShiftsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeShift, setActiveShift] = useState<any>(null);
  const [weekCalendar, setWeekCalendar] = useState<any[]>([]);
  const [allOrgShifts, setAllOrgShifts] = useState<any[]>([]);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Request Change Schedule Modal State
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [submittingChange, setSubmittingChange] = useState(false);
  const [changeForm, setChangeForm] = useState({
    requestedShiftId: "",
    effectiveDate: new Date().toISOString().split("T")[0],
    endDate: "",
    requestedPatternDays: ["MON", "TUE", "WED", "THU", "FRI"],
    reason: "",
  });

  // Fetch current week calendar and shift
  const fetchShiftData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Compute current week's Monday and Sunday
      const base = new Date();
      const day = base.getDay();
      const diffToMon = base.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(base.getFullYear(), base.getMonth(), diffToMon);
      const sunday = new Date(base.getFullYear(), base.getMonth(), diffToMon + 6);

      const toYmd = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const startStr = toYmd(monday);
      const endStr = toYmd(sunday);

      // 1. Fetch weekly calendar
      const calRes = await fetch(`/payrol/api/shifts/assignments?startDate=${startStr}&endDate=${endStr}`);
      const calData = await calRes.json();
      if (calRes.ok && calData.calendar) {
        setWeekCalendar(calData.calendar);
      }

      // 2. Fetch today's status to get active shift
      const statusRes = await fetch("/payrol/api/attendance/status");
      const statusData = await statusRes.json();
      if (statusRes.ok && statusData.status?.shift) {
        setActiveShift(statusData.status.shift);
      }

      // 3. Fetch org shifts for policy visibility
      const shiftsRes = await fetch("/payrol/api/shifts");
      const shiftsData = await shiftsRes.json();
      if (shiftsRes.ok && shiftsData.shifts) {
        setAllOrgShifts(shiftsData.shifts);
        setChangeForm((prev) => ({
          ...prev,
          requestedShiftId: prev.requestedShiftId || shiftsData.shifts[0]?.id || "",
        }));
      }

      // 4. Fetch employee schedule change requests
      const reqRes = await fetch("/payrol/api/shifts/change-requests");
      const reqData = await reqRes.json();
      if (reqRes.ok && reqData.requests) {
        setChangeRequests(reqData.requests);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load shift information");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShiftData();
  }, [fetchShiftData]);

  const openChangeModal = (preselectedShiftId?: string) => {
    setError(null);
    setChangeForm((prev) => ({
      ...prev,
      requestedShiftId: preselectedShiftId || prev.requestedShiftId || allOrgShifts[0]?.id || "",
    }));
    setShowChangeModal(true);
  };

  const togglePatternDay = (day: string) => {
    setChangeForm((prev) => {
      const exists = prev.requestedPatternDays.includes(day);
      const updated = exists
        ? prev.requestedPatternDays.filter((d) => d !== day)
        : [...prev.requestedPatternDays, day];
      return {
        ...prev,
        requestedPatternDays: updated.length > 0 ? updated : prev.requestedPatternDays,
      };
    });
  };

  const handleChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeForm.requestedShiftId || !changeForm.reason.trim()) {
      setError("Please select a shift and provide a reason for your schedule change request.");
      return;
    }

    try {
      setSubmittingChange(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch("/payrol/api/shifts/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changeForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit schedule change request.");

      setShowChangeModal(false);
      setChangeForm((prev) => ({ ...prev, endDate: "", reason: "" }));
      setSuccessMsg("Schedule change request submitted for HR/Manager approval.");
      await fetchShiftData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingChange(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#293381] tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#36B4FF]" />
            My Shift Schedule
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Assigned working hours, weekly rotation patterns, break intervals, and company shift catalog.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openChangeModal()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#293381] text-white hover:bg-[#1f2766] transition shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-[#36B4FF]" />
          Request Change Schedule
        </button>
      </div>

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center bg-white border border-slate-200 rounded-2xl">
          <Loader2 className="w-6 h-6 animate-spin text-[#293381] mx-auto" />
          <p className="text-xs text-slate-400 mt-2">Loading shift schedule...</p>
        </div>
      ) : (
        <>
          {/* Active Shift Hero Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-44 h-44 bg-[#36B4FF]/10 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[11px] font-bold text-[#36B4FF] uppercase tracking-wider">
                  Primary Shift Assignment
                </span>
                <h2 className="text-xl font-bold text-[#293381] mt-0.5">
                  {activeShift?.shiftName || activeShift?.name || "General Day Shift"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {activeShift?.isOvernight ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5" /> Overnight Shift
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5" /> Day Shift
                  </span>
                )}
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] text-slate-400 font-semibold uppercase">Working Hours</p>
                <p className="text-lg font-bold font-mono text-[#293381] mt-1">
                  {activeShift?.startTime || "09:00"} - {activeShift?.endTime || "18:00"}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">IST (UTC+05:30)</p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] text-slate-400 font-semibold uppercase">Grace Period</p>
                <p className="text-lg font-bold text-[#293381] mt-1">
                  {activeShift?.graceMinutes ?? 15} mins
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Allowed late window</p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] text-slate-400 font-semibold uppercase">Break Allowance</p>
                <p className="text-lg font-bold text-[#293381] mt-1">
                  {activeShift?.breakDurationMinutes ?? activeShift?.breakMinutes ?? 60} mins
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Deducted from gross duration</p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] text-slate-400 font-semibold uppercase">Min Half-Day</p>
                <p className="text-lg font-bold text-[#293381] mt-1">
                  {activeShift?.halfDayThresholdMinutes
                    ? `${(activeShift.halfDayThresholdMinutes / 60).toFixed(1)} hrs`
                    : "4.0 hrs"}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Threshold for half-day credit</p>
              </div>
            </div>
          </div>

          {/* Weekly Roster Pattern */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#293381] flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-[#36B4FF]" />
                  Weekly Roster (Current Week)
                </h3>
                <p className="text-xs text-slate-500">
                  Scheduled daily shifts and designated rest days for this week.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
              {weekCalendar.map((item, idx) => {
                const dayShift = item.shift || item;
                const dateObj = new Date(`${item.date}T12:00:00Z`);
                const dayName = dateObj.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }).toUpperCase();
                const isToday = item.date === new Date().toISOString().split("T")[0];

                return (
                  <div
                    key={idx}
                    className={`rounded-xl border p-4 text-center transition flex flex-col justify-between ${
                      isToday
                        ? "border-[#36B4FF] bg-[#36B4FF]/5 shadow-sm ring-2 ring-[#36B4FF]/30"
                        : dayShift?.isWorkingDay
                        ? "border-slate-200 bg-white"
                        : "border-slate-100 bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">
                          {dayName}
                        </span>
                        {isToday && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#36B4FF] text-[#293381] font-bold">
                            TODAY
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-700 mt-1">{item.date}</p>
                    </div>

                    <div className="my-3">
                      {dayShift?.isWorkingDay ? (
                        <div>
                          <p className="text-xs font-bold text-[#293381]">{dayShift.shiftName || dayShift.name}</p>
                          <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                            {dayShift.startTime} - {dayShift.endTime}
                          </p>
                        </div>
                      ) : (
                        <div className="py-2">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-200/70 text-slate-600">
                            WEEKEND / REST
                          </span>
                        </div>
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-semibold ${
                        dayShift?.isWorkingDay ? "text-emerald-600" : "text-slate-400"
                      }`}
                    >
                      {dayShift?.isWorkingDay ? "Working Day" : "Off Duty"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Schedule Change Requests History */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#293381] flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#36B4FF]" />
                  My Schedule Change Requests
                </h3>
                <p className="text-xs text-slate-500">
                  Track status of requested shift switches and working-day pattern updates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openChangeModal()}
                className="text-xs font-semibold text-[#293381] hover:underline self-start sm:self-auto"
              >
                + Request Change Schedule
              </button>
            </div>

            {changeRequests.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No schedule change requests submitted yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {changeRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#293381]">
                          {req.currentShiftName} → {req.requestedShiftName}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          ({req.requestedShiftTimings})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-2">
                        <span>
                          Effective: <strong>{req.effectiveDate}</strong>
                          {req.endDate ? ` to ${req.endDate}` : " (Ongoing)"}
                        </span>
                        <span>•</span>
                        <span>Days: {(req.patternDays || []).join(", ")}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 italic">&quot;{req.reason}&quot;</p>
                      {req.rejectionReason && (
                        <p className="text-[11px] text-rose-600 font-medium">
                          Rejection Note: {req.rejectionReason}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold self-start sm:self-center ${
                        req.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-700"
                          : req.status === "REJECTED"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Company Shift Reference Guide */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#293381]">Company Shift Catalog</h3>
              <p className="text-xs text-slate-500">Standard organizational shift definitions and timings.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allOrgShifts.map((sh) => (
                <div
                  key={sh.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-[#293381]">{sh.name}</h4>
                    <span className="font-mono text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-semibold">
                      {sh.code}
                    </span>
                  </div>
                  <p className="text-xs font-mono font-medium text-slate-800">
                    {sh.startTime} - {sh.endTime}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>Break: {sh.breakDurationMinutes ?? sh.breakMinutes ?? 60}m</span>
                      <span>•</span>
                      <span>Grace: {sh.graceMinutes ?? 15}m</span>
                      <span>•</span>
                      <span>{sh.isOvernight ? "Night" : "Day"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openChangeModal(sh.id)}
                      className="text-[11px] font-semibold text-[#293381] hover:text-[#36B4FF] transition"
                    >
                      Request Switch →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Request Change Schedule Modal */}
      {showChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-[#293381] text-base flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#36B4FF]" />
                Request Change Schedule
              </h3>
              <button
                type="button"
                onClick={() => setShowChangeModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangeSubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                  Current Assigned Schedule
                </span>
                <span className="font-bold text-[#293381] text-xs">
                  {activeShift?.shiftName || activeShift?.name || "General Day Shift"} (
                  {activeShift?.startTime || "09:00"} - {activeShift?.endTime || "18:00"})
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Requested Shift *</label>
                <select
                  value={changeForm.requestedShiftId}
                  onChange={(e) => setChangeForm({ ...changeForm, requestedShiftId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  required
                >
                  {allOrgShifts.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.name} ({sh.startTime} - {sh.endTime})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Effective From *</label>
                  <input
                    type="date"
                    value={changeForm.effectiveDate}
                    onChange={(e) => setChangeForm({ ...changeForm, effectiveDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Until (Optional)</label>
                  <input
                    type="date"
                    value={changeForm.endDate}
                    onChange={(e) => setChangeForm({ ...changeForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Working Days Pattern</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map((d) => (
                    <button
                      type="button"
                      key={d}
                      onClick={() => togglePatternDay(d)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition ${
                        changeForm.requestedPatternDays.includes(d)
                          ? "bg-[#293381] text-white border-[#293381]"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason for Schedule Change *</label>
                <textarea
                  value={changeForm.reason}
                  onChange={(e) => setChangeForm({ ...changeForm, reason: e.target.value })}
                  placeholder="Explain why you are requesting this schedule change (e.g., commute, client timezone overlap, personal requirement)..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowChangeModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingChange}
                  className="px-5 py-2 rounded-lg bg-[#293381] hover:bg-[#1f2766] text-white font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {submittingChange ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
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
