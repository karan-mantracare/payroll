"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Clock,
  GitFork,
  LogOut,
  MapPin,
  Users,
  X,
  AlertCircle,
  Loader2,
  Briefcase,
} from "lucide-react";

type JmlRequestType = "MOVE" | "LEAVE";
type JmlMoveCategory =
  | "DEPARTMENT_TRANSFER"
  | "LOCATION_RELOCATION"
  | "TEAM_CHANGE"
  | "ROLE_CHANGE";
type JmlLeaveCategory =
  | "VOLUNTARY_RESIGNATION"
  | "END_OF_CONTRACT"
  | "RETIREMENT"
  | "PERSONAL_REASONS";
type JmlRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";

interface EmployeeProfileContext {
  employeeId: string;
  employeeCode: string;
  jobTitle: string;
  joinedDate: string;
  employmentType: string;
  status: string;
  departmentId: string;
  departmentName: string;
  locationId: string;
  locationName: string;
  teamId: string | null;
  teamName: string | null;
}

interface LookupOptions {
  departments: Array<{ id: string; name: string; code: string }>;
  locations: Array<{ id: string; name: string; city: string }>;
  teams: Array<{ id: string; name: string; departmentId: string }>;
}

interface JmlRequestItem {
  id: string;
  requestType: JmlRequestType;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  effectiveDate: string;
  reason: string;
  status: JmlRequestStatus;
  moveDetails?: {
    moveCategory: JmlMoveCategory;
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
    leaveCategory: JmlLeaveCategory;
    noticePeriodDays: number;
    handoverPlan?: string;
  };
  reviewComment?: string;
  reviewedByName?: string;
  createdAt: number;
}

const MOVE_CATEGORY_LABELS: Record<JmlMoveCategory, string> = {
  DEPARTMENT_TRANSFER: "Department Transfer",
  LOCATION_RELOCATION: "Location Relocation",
  TEAM_CHANGE: "Team Change",
  ROLE_CHANGE: "Role / Designation Change",
};

const LEAVE_CATEGORY_LABELS: Record<JmlLeaveCategory, string> = {
  VOLUNTARY_RESIGNATION: "Voluntary Resignation",
  END_OF_CONTRACT: "End of Contract",
  RETIREMENT: "Retirement",
  PERSONAL_REASONS: "Personal / Other Reasons",
};

const STATUS_BADGE: Record<JmlRequestStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
  WITHDRAWN: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

export default function EmployeeOnboardingPage() {
  const [profile, setProfile] = useState<EmployeeProfileContext | null>(null);
  const [options, setOptions] = useState<LookupOptions>({ departments: [], locations: [], teams: [] });
  const [requests, setRequests] = useState<JmlRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Move modal state
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveCategory, setMoveCategory] = useState<JmlMoveCategory>("DEPARTMENT_TRANSFER");
  const [targetDepartmentId, setTargetDepartmentId] = useState("");
  const [targetLocationId, setTargetLocationId] = useState("");
  const [targetTeamId, setTargetTeamId] = useState("");
  const [targetJobTitle, setTargetJobTitle] = useState("");
  const [moveEffectiveDate, setMoveEffectiveDate] = useState("");
  const [moveReason, setMoveReason] = useState("");

  // Leave / Exit modal state
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveCategory, setLeaveCategory] = useState<JmlLeaveCategory>("VOLUNTARY_RESIGNATION");
  const [lastWorkingDate, setLastWorkingDate] = useState("");
  const [handoverPlan, setHandoverPlan] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/payroll/api/lifecycle/requests", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile || null);
        setOptions(data.options || { departments: [], locations: [], teams: [] });
        setRequests(Array.isArray(data.requests) ? data.requests : []);
      }
    } catch {
      // ignore transient refresh failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Esc key closes open modal
  useEffect(() => {
    if (!showMoveModal && !showLeaveModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowMoveModal(false);
        setShowLeaveModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showMoveModal, showLeaveModal]);

  const noticeDaysPreview = useMemo(() => {
    if (!lastWorkingDate) return 0;
    const todayStr = new Date().toISOString().split("T")[0];
    const start = new Date(`${todayStr}T00:00:00Z`).getTime();
    const end = new Date(`${lastWorkingDate}T00:00:00Z`).getTime();
    if (Number.isNaN(end)) return 0;
    return Math.max(0, Math.round((end - start) / (24 * 60 * 60 * 1000)));
  }, [lastWorkingDate]);

  const openMoveModal = () => {
    const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    setMoveCategory("DEPARTMENT_TRANSFER");
    setTargetDepartmentId(profile?.departmentId || "");
    setTargetLocationId(profile?.locationId || "");
    setTargetTeamId(profile?.teamId || "");
    setTargetJobTitle(profile?.jobTitle || "");
    setMoveEffectiveDate(in14Days);
    setMoveReason("");
    setModalError(null);
    setShowLeaveModal(false);
    setShowMoveModal(true);
  };

  const openLeaveModal = () => {
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    setLeaveCategory("VOLUNTARY_RESIGNATION");
    setLastWorkingDate(in30Days);
    setHandoverPlan("");
    setLeaveReason("");
    setModalError(null);
    setShowMoveModal(false);
    setShowLeaveModal(true);
  };

  const handleSubmitMove = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!moveEffectiveDate) {
      setModalError("Please choose a preferred effective date.");
      return;
    }
    if (moveReason.trim().length < 5) {
      setModalError("Please provide a reason for your move request (at least 5 characters).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/payroll/api/lifecycle/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "MOVE",
          moveCategory,
          targetDepartmentId: targetDepartmentId || null,
          targetLocationId: targetLocationId || null,
          targetTeamId: targetTeamId || null,
          targetJobTitle: targetJobTitle.trim() || null,
          effectiveDate: moveEffectiveDate,
          reason: moveReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || "Failed to submit move request.");
        return;
      }

      setShowMoveModal(false);
      setBanner({
        type: "success",
        text: "Your Request to Move has been submitted to HR & Admin for review.",
      });
      await loadData();
    } catch {
      setModalError("Network error while submitting move request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!lastWorkingDate) {
      setModalError("Please select a proposed Last Working Date.");
      return;
    }
    if (leaveReason.trim().length < 5) {
      setModalError("Please explain your reason for requesting to leave (at least 5 characters).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/payroll/api/lifecycle/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "LEAVE",
          leaveCategory,
          effectiveDate: lastWorkingDate,
          noticePeriodDays: noticeDaysPreview,
          handoverPlan: handoverPlan.trim() || undefined,
          reason: leaveReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || "Failed to submit leave / exit request.");
        return;
      }

      setShowLeaveModal(false);
      setBanner({
        type: "success",
        text: "Your Request to Leave / Offboarding has been submitted to HR & Admin for review.",
      });
      await loadData();
    } catch {
      setModalError("Network error while submitting leave / exit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (requestId: string) => {
    setWithdrawingId(requestId);
    setBanner(null);
    try {
      const res = await fetch("/payroll/api/lifecycle/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "WITHDRAW" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", text: data.error || "Failed to withdraw request." });
        return;
      }
      setBanner({ type: "success", text: "Request withdrawn successfully." });
      await loadData();
    } catch {
      setBanner({ type: "error", text: "Network error while withdrawing request." });
    } finally {
      setWithdrawingId(null);
    }
  };

  const formatMoveSummary = (req: JmlRequestItem) => {
    const m = req.moveDetails;
    if (!m) return "Internal Movement";
    const diffs: string[] = [];
    if (m.targetDepartmentName) diffs.push(`Dept: ${m.currentDepartmentName} -> ${m.targetDepartmentName}`);
    if (m.targetLocationName) diffs.push(`Location: ${m.currentLocationName} -> ${m.targetLocationName}`);
    if (m.targetTeamName) diffs.push(`Team: ${m.currentTeamName || "Unassigned"} -> ${m.targetTeamName}`);
    if (m.targetJobTitle) diffs.push(`Role: ${m.currentJobTitle} -> ${m.targetJobTitle}`);
    return diffs.length > 0 ? diffs.join(" · ") : MOVE_CATEGORY_LABELS[m.moveCategory];
  };

  return (
    <div className="space-y-6">
      {/* Header + JML Request Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
            <GitFork className="w-6 h-6 text-[#36B4FF]" />
            Onboarding &amp; JML
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Joiner checklist tasks, internal movement transfers (Mover), and separation / exit requests (Leaver).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            data-testid="request-to-move-btn"
            onClick={openMoveModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white transition shadow-sm"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-white" />
            <span>Request to Move</span>
          </button>
          <button
            type="button"
            data-testid="request-to-leave-btn"
            onClick={openLeaveModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800 transition shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Request to Leave</span>
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs font-medium ${
            banner.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
          <button type="button" onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Current Assignment Context */}
      {profile && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Building2 className="w-3.5 h-3.5 text-[#36B4FF]" /> Department
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{profile.departmentName}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-[#36B4FF]" /> Location
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{profile.locationName}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Users className="w-3.5 h-3.5 text-[#36B4FF]" /> Team
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">
              {profile.teamName || "General / Unassigned"}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Briefcase className="w-3.5 h-3.5 text-[#36B4FF]" /> Current Role
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{profile.jobTitle}</div>
          </div>
        </div>
      )}

      {/* Joiner Stage: Onboarding Checklist */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-slate-700 dark:text-slate-300 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Onboarding Checklist</h3>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            Joiner Complete
          </span>
        </div>
        <div className="space-y-2 text-xs">
          {[
            { task: "Identity Verification & Document Upload", status: "Completed" },
            { task: "Bank Account Details Submission", status: "Completed" },
            { task: "Information Security Policy Sign-off", status: "Completed" },
          ].map((t) => (
            <div
              key={t.task}
              className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-lg"
            >
              <span className="text-slate-700 dark:text-slate-300 font-medium">{t.task}</span>
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Mover & Leaver Requests History */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              My Move &amp; Leave Requests
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track department/location/role movement requests and separation applications.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            {requests.length} Total Request{requests.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading JML history...
          </div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            No Move or Leave requests submitted yet. Use <strong>Request to Move</strong> or{" "}
            <strong>Request to Leave</strong> above to initiate a lifecycle transition.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Transition Details</th>
                  <th className="py-3 px-4">Effective / LWD</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 whitespace-nowrap">
                      {req.requestType === "MOVE" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-[#293381] border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 text-[10px] font-bold">
                          <ArrowRightLeft className="w-3 h-3" /> MOVER
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 text-[10px] font-bold">
                          <LogOut className="w-3 h-3" /> LEAVER
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {req.requestType === "MOVE" ? (
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {req.moveDetails ? MOVE_CATEGORY_LABELS[req.moveDetails.moveCategory] : "Internal Move"}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{formatMoveSummary(req)}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {req.leaveDetails ? LEAVE_CATEGORY_LABELS[req.leaveDetails.leaveCategory] : "Exit Request"}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Notice Period: {req.leaveDetails?.noticePeriodDays ?? 0} day(s)
                            {req.leaveDetails?.handoverPlan ? ` · Handover: ${req.leaveDetails.handoverPlan}` : ""}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {req.effectiveDate}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs">
                      <div className="truncate" title={req.reason}>
                        {req.reason}
                      </div>
                      {req.reviewComment && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          HR Note: {req.reviewComment}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${STATUS_BADGE[req.status]}`}
                      >
                        {req.status === "PENDING" && <Clock className="w-2.5 h-2.5" />}
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {req.status === "PENDING" ? (
                        <button
                          type="button"
                          disabled={withdrawingId === req.id}
                          onClick={() => void handleWithdraw(req.id)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold disabled:opacity-50"
                        >
                          {withdrawingId === req.id ? "Withdrawing..." : "Withdraw"}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Request to Move */}
      {showMoveModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowMoveModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Request to Move"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div data-text-white="true" className="px-6 py-4 bg-[#293381] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ArrowRightLeft className="w-5 h-5 text-[#36B4FF]" />
                <div>
                  <h2 className="text-sm font-bold !text-white">Request to Move (Internal Transfer)</h2>
                  <p className="text-[11px] text-indigo-100">
                    Request a change in department, office location, team, or role.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitMove} className="p-6 space-y-4 text-xs">
              {modalError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Movement Type
                </label>
                <select
                  value={moveCategory}
                  onChange={(e) => setMoveCategory(e.target.value as JmlMoveCategory)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                >
                  <option value="DEPARTMENT_TRANSFER">Department Transfer</option>
                  <option value="LOCATION_RELOCATION">Location Relocation</option>
                  <option value="TEAM_CHANGE">Team Change</option>
                  <option value="ROLE_CHANGE">Role / Designation Change</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Department
                  </label>
                  <select
                    value={targetDepartmentId}
                    onChange={(e) => setTargetDepartmentId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  >
                    <option value="">Keep current</option>
                    {options.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Location
                  </label>
                  <select
                    value={targetLocationId}
                    onChange={(e) => setTargetLocationId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  >
                    <option value="">Keep current</option>
                    {options.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Team
                  </label>
                  <select
                    value={targetTeamId}
                    onChange={(e) => setTargetTeamId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  >
                    <option value="">Keep current</option>
                    {options.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Requested Role / Designation
                  </label>
                  <input
                    type="text"
                    value={targetJobTitle}
                    onChange={(e) => setTargetJobTitle(e.target.value)}
                    placeholder={profile?.jobTitle || "New role title"}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Preferred Effective Date
                </label>
                <input
                  type="date"
                  value={moveEffectiveDate}
                  onChange={(e) => setMoveEffectiveDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Move Request
                </label>
                <textarea
                  rows={3}
                  value={moveReason}
                  onChange={(e) => setMoveReason(e.target.value)}
                  placeholder="Describe why you are requesting this transfer, relocation, or role transition..."
                  required
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMoveModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white font-semibold disabled:opacity-60"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Move Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Request to Leave / Exit */}
      {showLeaveModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowLeaveModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Request to Leave"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div data-text-white="true" className="px-6 py-4 bg-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <LogOut className="w-5 h-5 text-rose-200" />
                <div>
                  <h2 className="text-sm font-bold !text-white">Request to Leave / Initiate Offboarding</h2>
                  <p className="text-[11px] text-rose-100">
                    Submit a resignation or separation request to HR for exit clearance.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="p-6 space-y-4 text-xs">
              {modalError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Separation Category
                </label>
                <select
                  value={leaveCategory}
                  onChange={(e) => setLeaveCategory(e.target.value as JmlLeaveCategory)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="VOLUNTARY_RESIGNATION">Voluntary Resignation</option>
                  <option value="END_OF_CONTRACT">End of Contract</option>
                  <option value="RETIREMENT">Retirement</option>
                  <option value="PERSONAL_REASONS">Personal / Other Reasons</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Proposed Last Working Date
                  </label>
                  <input
                    type="date"
                    value={lastWorkingDate}
                    onChange={(e) => setLastWorkingDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Notice Period
                  </label>
                  <div className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold">
                    {noticeDaysPreview} day{noticeDaysPreview === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Handover Plan / Transition Notes (Optional)
                </label>
                <input
                  type="text"
                  value={handoverPlan}
                  onChange={(e) => setHandoverPlan(e.target.value)}
                  placeholder="e.g., Transitioning active projects and credentials to team lead"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Leaving
                </label>
                <textarea
                  rows={3}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Provide details for HR and your reporting manager..."
                  required
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-60"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Leave Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
