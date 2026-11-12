"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Calendar,
  Plus,
  Send,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  FileText,
} from "lucide-react";

type AbsenceType = "PRIVILEGE_LEAVE" | "CASUAL_LEAVE" | "SICK_LEAVE";
type LeaveRequestStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

interface LeaveBalance {
  absenceType: AbsenceType;
  label: string;
  quota: number;
  used: number;
  pending: number;
  remaining: number;
}

interface LeaveRequestItem {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  absenceType: AbsenceType;
  reason: string;
  status: LeaveRequestStatus;
  rejectionReason?: string;
  createdAt: number;
}

interface HolidayItem {
  id: string;
  name: string;
  date: string;
  dayOfWeek: string;
  type: "Gazetted" | "Optional" | "Company Off";
  location: string;
}

const ABSENCE_LABELS: Record<AbsenceType, string> = {
  PRIVILEGE_LEAVE: "Privilege Leave",
  CASUAL_LEAVE: "Casual Leave",
  SICK_LEAVE: "Sick Leave",
};

const STATUS_BADGE: Record<LeaveRequestStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  PENDING: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

export default function EmployeeLeavesPage() {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"applications" | "holidays">("applications");

  // Modal State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [absenceType, setAbsenceType] = useState<"" | AbsenceType>("");
  const [reason, setReason] = useState("");
  const [submittingMode, setSubmittingMode] = useState<"DRAFT" | "PENDING" | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [leaveRes, holidayRes] = await Promise.all([
        fetch("/payroll/api/leaves/requests", { cache: "no-store" }),
        fetch("/payroll/api/holidays", { cache: "no-store" }),
      ]);

      if (leaveRes.ok) {
        const leaveData = await leaveRes.json();
        setBalances(Array.isArray(leaveData.balances) ? leaveData.balances : []);
        setRequests(Array.isArray(leaveData.requests) ? leaveData.requests : []);
      }

      if (holidayRes.ok) {
        const holidayData = await holidayRes.json();
        setHolidays(Array.isArray(holidayData.holidays) ? holidayData.holidays : []);
      }
    } catch {
      // handled silently on background refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const requestedDaysPreview = useMemo(() => {
    if (!startDate || !endDate) return null;
    const s = new Date(`${startDate}T00:00:00Z`);
    const e = new Date(`${endDate}T00:00:00Z`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
    if (e.getTime() < s.getTime()) return -1;
    return Math.floor((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  }, [startDate, endDate]);

  const openApplyModal = () => {
    const today = new Date().toISOString().split("T")[0];
    setStartDate(today);
    setEndDate(today);
    setAbsenceType("");
    setReason("");
    setErrorMsg(null);
    setShowApplyModal(true);
  };

  const handleSubmitLeave = async (mode: "DRAFT" | "PENDING") => {
    setErrorMsg(null);
    if (!startDate || !endDate) {
      setErrorMsg("Please select both Start date and End date.");
      return;
    }
    if (requestedDaysPreview !== null && requestedDaysPreview < 1) {
      setErrorMsg("End date cannot be earlier than Start date.");
      return;
    }
    if (!absenceType) {
      setErrorMsg("Please select an Absence type.");
      return;
    }

    setSubmittingMode(mode);
    try {
      const res = await fetch("/payroll/api/leaves/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          absenceType,
          reason: reason.trim(),
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save leave request");
      }

      setShowApplyModal(false);
      setSuccessMsg(
        mode === "PENDING"
          ? "Leave application submitted for approval."
          : "Leave application saved as draft."
      );
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Unable to submit leave request");
    } finally {
      setSubmittingMode(null);
    }
  };

  const handleRowAction = async (
    requestId: string,
    action: "APPLY_DRAFT" | "CANCEL"
  ) => {
    setActionId(requestId);
    setErrorMsg(null);
    try {
      const res = await fetch("/payroll/api/leaves/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Action failed");
      }
      setSuccessMsg(
        action === "APPLY_DRAFT"
          ? "Draft leave application submitted for approval."
          : "Leave request cancelled."
      );
      setTimeout(() => setSuccessMsg(null), 3500);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update request");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-[#36B4FF]" />
            My Leaves
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Apply for paid leaves, casual leaves, sick leave, and view upcoming holiday calendar.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={openApplyModal}
          data-testid="open-apply-leave-btn"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#293381] hover:bg-[#1f2766] text-white text-xs font-semibold shadow-sm transition self-start sm:self-auto disabled:opacity-60"
        >
          <Plus className="w-4 h-4" />
          Apply for Leave
        </button>
      </div>

      {/* Feedback Banners */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}
      {errorMsg && !showApplyModal && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(balances.length > 0
          ? balances
          : [
              { absenceType: "PRIVILEGE_LEAVE" as AbsenceType, label: "Privilege Leave", quota: 18, used: 0, pending: 0, remaining: 18 },
              { absenceType: "CASUAL_LEAVE" as AbsenceType, label: "Casual Leave", quota: 12, used: 0, pending: 0, remaining: 12 },
              { absenceType: "SICK_LEAVE" as AbsenceType, label: "Sick Leave", quota: 10, used: 0, pending: 0, remaining: 10 },
            ]
        ).map((bal) => (
          <div
            key={bal.absenceType}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {bal.label}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Quota: {bal.quota}d
              </span>
            </div>
            <div className="text-2xl font-bold text-[#293381] dark:text-white">
              {bal.remaining} Days
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
              <span>Used: {bal.used} Days</span>
              {bal.pending > 0 && (
                <span className="text-amber-600 font-semibold">
                  Pending: {bal.pending} Days
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs: Applications | Upcoming Holiday Calendar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("applications")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "applications"
                ? "bg-[#293381] text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            My Leave Applications ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("holidays")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "holidays"
                ? "bg-[#293381] text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Upcoming Holiday Calendar ({holidays.length})
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#36B4FF]" />
            Loading leave details...
          </div>
        ) : activeTab === "applications" ? (
          requests.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <CalendarDays className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No leave applications yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click &ldquo;Apply for Leave&rdquo; above to submit a new leave request or save a draft.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Date Range</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Absence Type</th>
                    <th className="px-4 py-3">Reason for Leave</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono font-semibold text-[#293381] dark:text-white whitespace-nowrap">
                        {req.startDate === req.endDate
                          ? req.startDate
                          : `${req.startDate} → ${req.endDate}`}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {req.totalDays} {req.totalDays === 1 ? "Day" : "Days"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-sky-50 text-[#293381] border border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800 text-[11px] font-semibold">
                          {ABSENCE_LABELS[req.absenceType] || req.absenceType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-xs">
                        <p className="line-clamp-2">{req.reason || "—"}</p>
                        {req.status === "REJECTED" && req.rejectionReason && (
                          <p className="mt-0.5 text-[11px] text-rose-600">
                            Note: {req.rejectionReason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${
                            STATUS_BADGE[req.status]
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        {req.status === "DRAFT" && (
                          <button
                            type="button"
                            disabled={actionId === req.id}
                            onClick={() => void handleRowAction(req.id, "APPLY_DRAFT")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#293381] text-white text-[11px] font-semibold hover:bg-[#1f2766] disabled:opacity-50"
                          >
                            <Send className="w-3 h-3" />
                            Apply
                          </button>
                        )}
                        {(req.status === "DRAFT" || req.status === "PENDING") && (
                          <button
                            type="button"
                            disabled={actionId === req.id}
                            onClick={() => void handleRowAction(req.id, "CANCEL")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : holidays.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            No company holidays configured for this year yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Day</th>
                  <th className="px-4 py-3">Holiday</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {holidays.map((hol) => (
                  <tr key={hol.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-semibold text-[#293381] dark:text-white">
                      {hol.date}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {hol.dayOfWeek}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {hol.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-[#293381] border border-indigo-200 text-[10px] font-bold uppercase">
                        {hol.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{hol.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply for Leave Modal */}
      {showApplyModal && (
        <div
          data-testid="apply-leave-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-[#293381] dark:text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-[#36B4FF]" />
                Apply for Leave
              </h2>
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    <span className="text-rose-500 mr-1">*</span>Start date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (!endDate || e.target.value > endDate) {
                        setEndDate(e.target.value);
                      }
                    }}
                    data-testid="leave-start-date"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    <span className="text-rose-500 mr-1">*</span>End date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    data-testid="leave-end-date"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                    required
                  />
                </div>
              </div>

              {requestedDaysPreview !== null && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <Clock className="w-3.5 h-3.5 text-[#36B4FF]" />
                  {requestedDaysPreview < 1 ? (
                    <span className="text-rose-600">
                      End date cannot be earlier than Start date
                    </span>
                  ) : (
                    <span className="text-[#293381] dark:text-[#36B4FF]">
                      Duration: {requestedDaysPreview}{" "}
                      {requestedDaysPreview === 1 ? "day" : "days"}
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  <span className="text-rose-500 mr-1">*</span>Absence type
                </label>
                <select
                  value={absenceType}
                  onChange={(e) => setAbsenceType(e.target.value as AbsenceType | "")}
                  data-testid="leave-absence-type"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  required
                >
                  <option value="">(not set)</option>
                  {balances.map((b) => (
                    <option key={b.absenceType} value={b.absenceType}>
                      {b.label} ({Math.max(0, b.remaining - b.pending)} days available)
                    </option>
                  ))}
                  {balances.length === 0 && (
                    <>
                      <option value="PRIVILEGE_LEAVE">Privilege Leave</option>
                      <option value="CASUAL_LEAVE">Casual Leave</option>
                      <option value="SICK_LEAVE">Sick Leave</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Reason for leave
                </label>
                <textarea
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  data-testid="leave-reason"
                  placeholder="Provide details for your leave request..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  data-testid="leave-cancel-btn"
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingMode !== null}
                  onClick={() => void handleSubmitLeave("DRAFT")}
                  data-testid="leave-save-draft-btn"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-semibold transition disabled:opacity-50"
                >
                  {submittingMode === "DRAFT" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save
                </button>
                <button
                  type="button"
                  disabled={submittingMode !== null}
                  onClick={() => void handleSubmitLeave("PENDING")}
                  data-testid="leave-apply-submit-btn"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#293381] hover:bg-[#1f2766] text-white font-bold shadow-sm transition disabled:opacity-50"
                >
                  {submittingMode === "PENDING" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
