"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckSquare, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type ProfileChangeStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";

interface AdminProfileChangeRequest {
  id: string;
  employeeCode: string;
  employeeName: string;
  fieldLabel: string;
  currentValue: string;
  requestedValue: string;
  reason: string;
  status: ProfileChangeStatus;
  reviewedByName?: string;
  createdAt: number;
}

const STATUS_BADGE: Record<ProfileChangeStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
  WITHDRAWN: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

export default function AdminApprovalsPage() {
  const [requests, setRequests] = useState<AdminProfileChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "PENDING">("ALL");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch("/payrol/api/profile/change-requests?scope=all", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data.requests) ? data.requests : []);
      }
    } catch {
      // ignore transient error
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
      const res = await fetch("/payrol/api/profile/change-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback(`Profile change request ${action === "APPROVE" ? "approved" : "rejected"}.`);
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

  const filteredRequests = useMemo(() => {
    if (filter === "PENDING") return requests.filter((r) => r.status === "PENDING");
    return requests;
  }, [requests, filter]);

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
          <CheckSquare className="w-6 h-6 text-[#36B4FF]" />
          Approvals &amp; Requests
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Centralized administrative approval queue for employee profile updates, escalations, and general requests.
        </p>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[#293381] text-xs font-semibold">
          {feedback}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#293381] dark:text-white">
              Employee Profile Change Requests
            </h2>
            <p className="text-[11px] text-slate-500">
              Approve verified employee record updates (automatically syncs supported profile fields) or decline invalid requests.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {pendingCount} Pending
            </span>
            {(["ALL", "PENDING"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-lg font-semibold text-[11px] transition ${
                  filter === tab
                    ? "bg-[#293381] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {tab === "ALL" ? "All" : "Pending"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading approval queue...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No profile change requests awaiting review.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Field</th>
                  <th className="py-3 px-4">Current &rarr; Requested</th>
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
                    <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      {req.fieldLabel}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-500">{req.currentValue}</span>
                      <span className="mx-1.5 text-slate-400">&rarr;</span>
                      <span className="font-semibold text-[#293381] dark:text-[#36B4FF]">
                        {req.requestedValue}
                      </span>
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
