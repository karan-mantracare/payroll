"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import {
  User,
  Mail,
  MapPin,
  Shield,
  Briefcase,
  Calendar,
  Phone,
  Clock,
  Loader2,
  CheckCircle2,
  Edit3,
  X,
  AlertCircle,
} from "lucide-react";
import DocumentVault from "@/components/DocumentVault";
import SensitiveFinancialCard from "@/components/SensitiveFinancialCard";

type ProfileChangeField =
  | "NAME"
  | "PHONE"
  | "PERSONAL_EMAIL"
  | "EMERGENCY_CONTACT"
  | "DATE_OF_BIRTH"
  | "GENDER"
  | "BANK_DETAILS"
  | "OTHER";

type ProfileChangeStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";

interface ProfileChangeRequestItem {
  id: string;
  field: ProfileChangeField;
  fieldLabel: string;
  currentValue: string;
  requestedValue: string;
  reason: string;
  status: ProfileChangeStatus;
  reviewComment?: string;
  createdAt: number;
}

const FIELD_OPTIONS: Array<{ value: ProfileChangeField; label: string }> = [
  { value: "PHONE", label: "Phone Number" },
  { value: "PERSONAL_EMAIL", label: "Personal Email" },
  { value: "EMERGENCY_CONTACT", label: "Emergency Contact (Name & Phone)" },
  { value: "NAME", label: "Full Name" },
  { value: "DATE_OF_BIRTH", label: "Date of Birth" },
  { value: "GENDER", label: "Gender" },
  { value: "BANK_DETAILS", label: "Bank / Tax Details" },
  { value: "OTHER", label: "Other Profile Information" },
];

const STATUS_BADGE: Record<ProfileChangeStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
  WITHDRAWN: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

export default function EmployeeProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [changeRequests, setChangeRequests] = useState<ProfileChangeRequestItem[]>([]);

  // Modal state
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [selectedField, setSelectedField] = useState<ProfileChangeField>("PHONE");
  const [requestedValue, setRequestedValue] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const requestsPromise = fetch("/payroll/api/profile/change-requests", { cache: "no-store" });
      const empPromise = user?.employeeId
        ? fetch(`/payroll/api/employees/${user.employeeId}`, { cache: "no-store" })
        : Promise.resolve(null);

      const [empRes, reqRes] = await Promise.all([empPromise, requestsPromise]);

      if (empRes && empRes.ok) {
        const empJson = await empRes.json();
        if (empJson?.data) setProfile(empJson.data);
      }

      if (reqRes.ok) {
        const reqJson = await reqRes.json();
        setChangeRequests(Array.isArray(reqJson.requests) ? reqJson.requests : []);
      }
    } catch {
      // handled silently
    } finally {
      setLoading(false);
    }
  }, [user?.employeeId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Esc key closes Request Change modal
  useEffect(() => {
    if (!showChangeModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowChangeModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showChangeModal]);

  const currentFieldValue = useMemo(() => {
    switch (selectedField) {
      case "NAME":
        return profile?.name || user?.name || "Not set";
      case "PHONE":
        return profile?.phone || "Not set";
      case "PERSONAL_EMAIL":
        return profile?.personalEmail || "Not set";
      case "EMERGENCY_CONTACT":
        return profile?.emergencyContactName || profile?.emergencyContactPhone
          ? `${profile?.emergencyContactName || "—"} (${profile?.emergencyContactPhone || "—"})`
          : "Not set";
      case "DATE_OF_BIRTH":
        return profile?.dateOfBirth || "Not set";
      case "GENDER":
        return profile?.gender || "Not set";
      case "BANK_DETAILS":
        return "On File (AES-256-GCM Protected)";
      default:
        return "Current Profile Record";
    }
  }, [selectedField, profile, user?.name]);

  const openChangeModal = () => {
    setSelectedField("PHONE");
    setRequestedValue("");
    setEmergencyPhone("");
    setReason("");
    setModalError(null);
    setShowChangeModal(true);
  };

  const handleSubmitChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!requestedValue.trim()) {
      setModalError("Please enter the requested new value.");
      return;
    }
    if (reason.trim().length < 4) {
      setModalError("Please provide a brief reason for requesting this change.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/payroll/api/profile/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: selectedField,
          requestedValue: requestedValue.trim(),
          emergencyPhone: selectedField === "EMERGENCY_CONTACT" ? emergencyPhone.trim() : undefined,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || "Failed to submit profile change request.");
        return;
      }

      setShowChangeModal(false);
      setBanner({
        type: "success",
        text: "Your profile change request has been submitted to HR & Admin for review.",
      });
      await loadAll();
    } catch {
      setModalError("Network error while submitting request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (requestId: string) => {
    setWithdrawingId(requestId);
    setBanner(null);
    try {
      const res = await fetch("/payroll/api/profile/change-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "WITHDRAW" }),
      });
      if (res.ok) {
        setBanner({ type: "success", text: "Profile change request withdrawn." });
        await loadAll();
      }
    } finally {
      setWithdrawingId(null);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "PROBATION":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "ON_LEAVE":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default:
        return "bg-slate-700 text-slate-300 border-slate-600";
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
            <User className="w-6 h-6 text-[#293381] dark:text-[#36B4FF]" />
            My Profile &amp; Employment Details
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review your personal records, emergency contacts, employment contract, and reporting line.
          </p>
        </div>

        <button
          type="button"
          data-testid="request-profile-change-btn"
          onClick={openChangeModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white transition shadow-sm shrink-0"
        >
          <Edit3 className="w-3.5 h-3.5 text-white" />
          <span>Request Change</span>
        </button>
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

      {loading ? (
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#293381] dark:text-[#36B4FF]" />
          <span className="text-sm">Loading your profile...</span>
        </div>
      ) : (
        <>
          {/* Hero Profile Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#293381] to-[#36B4FF] flex items-center justify-center text-white text-2xl font-bold font-mono shrink-0 shadow-md">
                  {(profile?.name || user?.name || "E").charAt(0)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold text-[#293381] dark:text-white">
                      {profile?.name || user?.name}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-md bg-[#293381]/10 text-[#293381] dark:text-[#36B4FF] border border-[#293381]/20 font-mono text-xs font-bold">
                      {profile?.employeeCode || user?.employeeId}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(
                        profile?.status || "ACTIVE"
                      )}`}
                    >
                      {profile?.status || "ACTIVE"}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
                    {profile?.jobTitle || "Team Member"} • {profile?.departmentName || "Engineering"}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {profile?.email || user?.email}
                    </span>
                    {profile?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" /> {profile.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {profile?.locationName || "HQ"}
                    </span>
                    {profile?.joinedDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Joined {profile.joinedDate}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Employment Information */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-card space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#293381] dark:text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" /> Employment Master Record
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Employee ID</span>
                  <span className="font-mono font-bold text-[#293381] dark:text-[#36B4FF]">
                    {profile?.employeeCode || user?.employeeId}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Employment Type</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {profile?.employmentType || "FULL_TIME"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Probation Status</span>
                  <span className="font-semibold text-[#36B4FF]">
                    {profile?.probationStatus || "CONFIRMED"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Department</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {profile?.departmentName || "Engineering"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Location</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {profile?.locationName || "HQ"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Personal Email</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {profile?.personalEmail || "Not set"}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Emergency Contact</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {profile?.emergencyContactName
                      ? `${profile.emergencyContactName}${
                          profile.emergencyContactPhone ? ` (${profile.emergencyContactPhone})` : ""
                        }`
                      : "Not set"}
                  </span>
                </div>
              </div>
            </div>

            {/* Reporting Line & Manager */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-card space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#293381] dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" /> Reporting Manager
              </h3>

              {profile?.manager ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Direct Reports To
                  </span>
                  <div className="font-bold text-[#293381] dark:text-white text-sm">
                    {profile.manager.name}
                  </div>
                  <div className="text-xs text-[#293381] dark:text-[#36B4FF] font-mono mt-0.5">
                    {profile.manager.employeeCode}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {profile.manager.jobTitle}
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-400">
                  Top of reporting hierarchy (No direct manager assigned)
                </div>
              )}

              <div className="p-3 rounded-lg bg-[#EBF7FF] dark:bg-[#293381]/20 border border-[#36B4FF]/30 text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-[#293381] dark:text-[#36B4FF] block mb-0.5">
                  Privacy &amp; Data Scope:
                </span>
                Your profile view is restricted strictly to your authorized self-service boundary (Scope:{" "}
                <span className="font-mono font-semibold">{user?.widestScope}</span>). Sensitive compensation and bank details are protected via AES-256-GCM.
              </div>
            </div>
          </div>

          {/* Profile Change Requests History */}
          {changeRequests.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#293381] dark:text-white">
                    My Profile Change Requests
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Submitted updates to personal contact, identity, emergency contact, or banking details.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  {changeRequests.length} Request{changeRequests.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-4">Field</th>
                      <th className="py-2.5 px-4">Current Value</th>
                      <th className="py-2.5 px-4">Requested Change</th>
                      <th className="py-2.5 px-4">Reason</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {changeRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {req.fieldLabel}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">{req.currentValue}</td>
                        <td className="py-2.5 px-4 font-semibold text-[#293381] dark:text-[#36B4FF]">
                          {req.requestedValue}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {req.reason}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${STATUS_BADGE[req.status]}`}
                          >
                            {req.status === "PENDING" && <Clock className="w-2.5 h-2.5" />}
                            {req.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
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
            </div>
          )}

          {/* Sensitive Compensation & Banking Details */}
          {(profile?.id || user?.employeeId) && (
            <SensitiveFinancialCard employeeId={profile?.id || user?.employeeId} canManage={false} />
          )}

          {/* Employee Document Vault */}
          {(profile?.id || user?.employeeId) && (
            <DocumentVault employeeId={profile?.id || user?.employeeId} canUpload={true} canVerify={false} />
          )}
        </>
      )}

      {/* Request Profile Change Modal */}
      {showChangeModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowChangeModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Request Profile Change"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              data-text-white="true"
              className="px-6 py-4 bg-[#293381] text-white flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Edit3 className="w-5 h-5 text-[#36B4FF]" />
                <div>
                  <h2 className="text-sm font-bold text-white">Request Profile Change</h2>
                  <p className="text-[11px] text-indigo-100">
                    Submit a verified correction or update request to HR.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChangeModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitChange} className="p-6 space-y-4 text-xs">
              {modalError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Profile Field to Update
                </label>
                <select
                  value={selectedField}
                  onChange={(e) => {
                    setSelectedField(e.target.value as ProfileChangeField);
                    setRequestedValue("");
                    setEmergencyPhone("");
                    setModalError(null);
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                >
                  {FIELD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Value on Record
                </label>
                <div className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-medium">
                  {currentFieldValue}
                </div>
              </div>

              {selectedField === "DATE_OF_BIRTH" ? (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Requested Date of Birth
                  </label>
                  <input
                    type="date"
                    value={requestedValue}
                    onChange={(e) => setRequestedValue(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
              ) : selectedField === "EMERGENCY_CONTACT" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Contact Person Name
                    </label>
                    <input
                      type="text"
                      value={requestedValue}
                      onChange={(e) => setRequestedValue(e.target.value)}
                      placeholder="Full name"
                      required
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Contact Phone Number
                    </label>
                    <input
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="+91 98XXXXXXXX"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Requested New Value
                  </label>
                  <input
                    type={selectedField === "PERSONAL_EMAIL" ? "email" : "text"}
                    value={requestedValue}
                    onChange={(e) => setRequestedValue(e.target.value)}
                    placeholder={
                      selectedField === "PHONE"
                        ? "+91 98765 43210"
                        : selectedField === "PERSONAL_EMAIL"
                        ? "name@example.com"
                        : selectedField === "BANK_DETAILS"
                        ? "e.g., Bank Name / Account / IFSC update details"
                        : "Enter updated value"
                    }
                    required
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Change Request
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this record needs to be updated (e.g., updated mobile number, name spelling correction)..."
                  required
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowChangeModal(false)}
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
