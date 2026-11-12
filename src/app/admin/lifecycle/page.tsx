"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, GitFork, Loader2, LogOut, CheckCircle2, XCircle } from "lucide-react";

type JmlRequestType = "MOVE" | "LEAVE";
type JmlRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";

interface AdminJmlRequest {
  id: string;
  requestType: JmlRequestType;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeEmail: string;
  effectiveDate: string;
  reason: string;
  status: JmlRequestStatus;
  moveDetails?: {
    moveCategory: string;
    currentDepartmentName: string;
    currentLocationName: string;
    currentTeamName: string | null;
    currentJobTitle: string;
    targetDepartmentName?: string | null;
    targetLocationName?: string | null;
    targetTeamName?: string | null;
    targetJobTitle?: string | null;
  };
  leaveDetails?: {
    leaveCategory: string;
    noticePeriodDays: number;
    handoverPlan?: string;
  };
  reviewComment?: string;
  reviewedByName?: string;
  createdAt: number;
}

const STATUS_BADGE: Record<JmlRequestStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
  WITHDRAWN: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

export default function AdminLifecyclePage() {
  const [requests, setRequests] = useState<AdminJmlRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"ALL" | "MOVE" | "LEAVE" | "PENDING">("ALL");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch("/payroll/api/lifecycle/requests?scope=all", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data.requests) ? data.requests : []);
      }
    } catch {
      // handled silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleReview = async (requestId: string, action: "APPROVE" | "REJECT") => {
    setProcessingId(requestId);
    setFeedback(null);
    try {
      const res = await fetch("/payroll/api/lifecycle/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback(`Lifecycle request ${action === "APPROVE" ? "approved" : "rejected"}.`);
        await loadRequests();
      } else {
        setFeedback(data.error || "Unable to review request.");
      }
    } catch {
      setFeedback("Network error while updating request.");
    } finally {
      setProcessingId(null);
    }
  };

  const moverPending = requests.filter((r) => r.requestType === "MOVE" && r.status === "PENDING").length;
  const leaverPending = requests.filter((r) => r.requestType === "LEAVE" && r.status === "PENDING").length;

  const filteredRequests = useMemo(() => {
    if (filterType === "MOVE") return requests.filter((r) => r.requestType === "MOVE");
    if (filterType === "LEAVE") return requests.filter((r) => r.requestType === "LEAVE");
    if (filterType === "PENDING") return requests.filter((r) => r.status === "PENDING");
    return requests;
  }, [requests, filterType]);

  const formatTransitionSummary = (req: AdminJmlRequest) => {
    if (req.requestType === "MOVE" && req.moveDetails) {
      const m = req.moveDetails;
      const parts: string[] = [];
      if (m.targetDepartmentName) parts.push(`Dept: ${m.currentDepartmentName} -> ${m.targetDepartmentName}`);
      if (m.targetLocationName) parts.push(`Loc: ${m.currentLocationName} -> ${m.targetLocationName}`);
      if (m.targetTeamName) parts.push(`Team: ${m.currentTeamName || "None"} -> ${m.targetTeamName}`);
      if (m.targetJobTitle) parts.push(`Role: ${m.currentJobTitle} -> ${m.targetJobTitle}`);
      return parts.join(" · ") || m.moveCategory;
    }
    if (req.leaveDetails) {
      return `${req.leaveDetails.leaveCategory.replace(/_/g, " ")} (${req.leaveDetails.noticePeriodDays}d notice)${
        req.leaveDetails.handoverPlan ? ` · ${req.leaveDetails.handoverPlan}` : ""
      }`;
    }
    return "Lifecycle Request";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
          <GitFork className="w-6 h-6 text-[#36B4FF]" />
          Employee Lifecycle (JML)
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Joiner, Mover, Leaver transitions, internal movement approvals, and exit clearance.
        </p>
      </div>

      {/* Live JML Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5 shadow-sm">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Joiner (Onboarding)</h3>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">Active</div>
          <span className="text-[11px] text-slate-500 font-mono">Checklist Workflow Ready</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5 shadow-sm">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Mover (Promotions / Transfers)</h3>
          <div className="text-xl font-bold text-[#293381] dark:text-indigo-400">
            {moverPending} Pending
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {requests.filter((r) => r.requestType === "MOVE").length} Total Move Requests
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5 shadow-sm">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Leaver (Offboarding &amp; Handover)</h3>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
            {leaverPending} Pending
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {requests.filter((r) => r.requestType === "LEAVE").length} Total Leave / Exit Requests
          </span>
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[#293381] text-xs font-semibold">
          {feedback}
        </div>
      )}

      {/* Mover & Leaver Requests Queue */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#293381] dark:text-white">
              Mover &amp; Leaver Requests Queue
            </h2>
            <p className="text-[11px] text-slate-500">
              Approve or decline internal transfer requests (updates employee assignment on approval) and exit applications.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            {(["ALL", "PENDING", "MOVE", "LEAVE"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterType(tab)}
                className={`px-3 py-1 rounded-lg font-semibold text-[11px] transition ${
                  filterType === tab
                    ? "bg-[#293381] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {tab === "ALL" ? "All" : tab === "PENDING" ? "Pending" : tab === "MOVE" ? "Movers" : "Leavers"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading lifecycle requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No lifecycle requests match the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">JML Stage</th>
                  <th className="py-3 px-4">Requested Change / Exit</th>
                  <th className="py-3 px-4">Effective / LWD</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      <div>{req.employeeName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{req.employeeCode}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {req.requestType === "MOVE" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-[#293381] border border-indigo-200 text-[10px] font-bold">
                          <ArrowRightLeft className="w-3 h-3" /> MOVER
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                          <LogOut className="w-3 h-3" /> LEAVER
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs">
                      {formatTransitionSummary(req)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {req.effectiveDate}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={req.reason}>
                      {req.reason}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${STATUS_BADGE[req.status]}`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      {req.status === "PENDING" ? (
                        <>
                          <button
                            type="button"
                            disabled={processingId === req.id}
                            onClick={() => void handleReview(req.id, "APPROVE")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Approve
                          </button>
                          <button
                            type="button"
                            disabled={processingId === req.id}
                            onClick={() => void handleReview(req.id, "REJECT")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" /> Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          {req.reviewedByName ? `By ${req.reviewedByName}` : "Reviewed"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
