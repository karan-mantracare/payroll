"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import {
  User,
  Mail,
  Building,
  MapPin,
  Shield,
  Briefcase,
  Calendar,
  Phone,
  Clock,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import DocumentVault from "@/components/DocumentVault";
import SensitiveFinancialCard from "@/components/SensitiveFinancialCard";

export default function EmployeeProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.employeeId) {
      fetch(`/payrol/api/employees/${user.employeeId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.data) setProfile(json.data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user?.employeeId]);

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
      <div>
        <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
          <User className="w-6 h-6 text-[#293381] dark:text-[#36B4FF]" />
          My Profile & Employment Details
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review your personal records, emergency contacts, employment contract, and reporting line.
        </p>
      </div>

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
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Location</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {profile?.locationName || "HQ"}
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
                  Privacy & Data Scope:
                </span>
                Your profile view is restricted strictly to your authorized self-service boundary (Scope:{" "}
                <span className="font-mono font-semibold">{user?.widestScope}</span>). Sensitive compensation and bank details are protected via AES-256-GCM.
              </div>
            </div>
          </div>

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
    </div>
  );
}
