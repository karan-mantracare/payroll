"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, Key, CheckCircle, RefreshCw, Loader2 } from "lucide-react";

export default function AdminAccessPage() {
  const [auditData, setAuditData] = useState<{
    records: any[];
    integrity: { chainValid: boolean; error?: string };
    totalCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAuditLogs = () => {
    setLoading(true);
    fetch("/payrol/api/audit")
      .then((res) => res.json())
      .then((data) => {
        setAuditData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-400" />
            Access & Administration
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            RBAC Permission Registry, active roles, and tamper-evident SHA-256 audit log verifier.
          </p>
        </div>
        <button
          onClick={fetchAuditLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Verify Integrity Chain
        </button>
      </div>

      {/* The 6 Default System Roles Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Key className="w-4 h-4 text-indigo-400" />
          The 6 System Roles & Baseline Data Scopes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { key: "SUPER_ADMIN", name: "Super Administrator", scope: "ORGANIZATION (Bypass)", access: "Admin + Employee" },
            { key: "ADMIN", name: "Administrator", scope: "ORGANIZATION", access: "Admin + Employee" },
            { key: "HR_MANAGER", name: "HR Manager", scope: "ORGANIZATION", access: "Admin + Employee" },
            { key: "HR_EXECUTIVE", name: "HR Executive", scope: "DEPARTMENT", access: "Admin + Employee" },
            { key: "TEAM_MANAGER", name: "Team Manager", scope: "DIRECT_REPORTS / TEAM", access: "Employee (Admin optional)" },
            { key: "EMPLOYEE", name: "Employee", scope: "SELF", access: "Employee Portal" },
          ].map((r) => (
            <div key={r.key} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs">{r.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-indigo-400 border border-indigo-500/20">
                  {r.key}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Scope: <span className="font-mono text-slate-300">{r.scope}</span>
              </div>
              <div className="text-[10px] text-slate-500">Portals: {r.access}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tamper-Evident SHA-256 Audit Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Tamper-Evident SHA-256 Audit Log
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Append-only cryptographic hash chain: any modified or dropped log breaks the verification check.
            </p>
          </div>
          {auditData && (
            <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
              auditData.integrity.chainValid
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}>
              {auditData.integrity.chainValid ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Hash Chain Verified (100% Intact)</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Chain Tampered: {auditData.integrity.error}</span>
                </>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            <span>Verifying audit record hashes...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Actor ID</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">SHA-256 Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 text-[11px]">
                {auditData?.records && auditData.records.length > 0 ? (
                  auditData.records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                        {new Date(rec.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2 text-indigo-400">{rec.actorUserId}</td>
                      <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{rec.action}</td>
                      <td className="px-3 py-2 text-slate-400">
                        {rec.targetEntity}:{rec.targetId}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-slate-500 truncate max-w-[180px]">
                        {rec.currentHash}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                      No audit events recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

