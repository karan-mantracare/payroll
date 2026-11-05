"use client";

import React, { useEffect, useState } from "react";
import {
  Users2,
  ShieldAlert,
  Loader2,
  Building,
  Mail,
  UserCheck,
  ChevronRight,
  GitCommit,
  Network,
  Calendar,
  Briefcase,
  AlertCircle,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/components/AuthGate";

export default function EmployeeTeamPage() {
  const { hasPermission, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"direct_reports" | "peers" | "chain">("direct_reports");
  const [data, setData] = useState<{
    currentEmployee: any;
    manager: any;
    directReports: any[];
    peers: any[];
    managerChain: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewTeam =
    hasPermission("dash.team.view") ||
    hasPermission("team.direct_reports.read") ||
    hasPermission("hierarchy.read");

  useEffect(() => {
    setLoading(true);
    fetch("/payrol/api/dash/team")
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to load team information");
        }
        return res.json();
      })
      .then((resData) => {
        setData(resData);
        // Default to peers if user has no direct reports
        if (!resData.directReports || resData.directReports.length === 0) {
          setActiveTab("peers");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (!canViewTeam) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
        <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Module 10: My Team (Restricted Access)</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          You do not hold permissions to view the team hierarchy. Please contact your administrator if you believe this is in error.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[350px] flex items-center justify-center flex-col gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-xs text-slate-400">Loading your team hierarchy & direct reports...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-3 max-w-lg mx-auto">
        <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
        <h3 className="text-sm font-bold text-white">Team Information Unavailable</h3>
        <p className="text-xs text-slate-400">{error || "Unable to fetch team hierarchy."}</p>
      </div>
    );
  }

  const { currentEmployee, manager, directReports, peers, managerChain } = data;

  return (
    <div className="space-y-6">
      {/* Page Title & Scope Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users2 className="w-6 h-6 text-emerald-400" />
            My Team & Reporting Line
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Department: <span className="text-slate-200 font-semibold">{currentEmployee.departmentName || "General"}</span> • Scope:{" "}
            <span className="font-mono text-emerald-400">{user?.widestScope}</span>
          </p>
        </div>

        {/* Manager Card Header */}
        {manager && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              {manager.name.charAt(0)}
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Reporting Manager
              </span>
              <span className="font-bold text-white">{manager.name}</span>
              <span className="text-slate-400 block text-[11px]">{manager.jobTitle}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("direct_reports")}
          className={`pb-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === "direct_reports"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          My Direct Reports ({directReports.length})
        </button>
        <button
          onClick={() => setActiveTab("peers")}
          className={`pb-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === "peers"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users2 className="w-3.5 h-3.5" />
          Team Colleagues / Peers ({peers.length})
        </button>
        <button
          onClick={() => setActiveTab("chain")}
          className={`pb-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === "chain"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <GitCommit className="w-3.5 h-3.5" />
          Reporting Chain Upward
        </button>
      </div>

      {/* TAB 1: Direct Reports */}
      {activeTab === "direct_reports" && (
        <div className="space-y-4">
          {directReports.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-2">
              <UserCheck className="w-8 h-8 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-white">No Direct Reports Assigned</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                You are currently an individual contributor. Any subordinates assigned to report to you will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {directReports.map((member) => (
                <div key={member.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-emerald-400">{member.employeeCode}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      {member.status}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{member.name}</h3>
                    <p className="text-xs text-slate-400">{member.jobTitle}</p>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                      <Mail className="w-3 h-3" /> {member.email}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>{member.departmentName || "Engineering"}</span>
                    <span className="font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                      {member.directReportsCount} reports
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Team Peers */}
      {activeTab === "peers" && (
        <div className="space-y-4">
          {peers.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-2">
              <Users2 className="w-8 h-8 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-white">No Team Peers Under Same Manager</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No other team members currently share the same direct reporting manager.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {peers.map((peer) => (
                <div key={peer.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-emerald-400">{peer.employeeCode}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                      {peer.status}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{peer.name}</h3>
                    <p className="text-xs text-slate-400">{peer.jobTitle}</p>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                      <Mail className="w-3 h-3" /> {peer.email}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                    Department: <span className="text-slate-300">{peer.departmentName || "Engineering"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Upward Reporting Chain */}
      {activeTab === "chain" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Network className="w-4 h-4 text-emerald-400" />
              Organizational Reporting Chain
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Your hierarchical reporting line from your current role up to executive leadership.
            </p>
          </div>

          <div className="space-y-3">
            {/* Self Node */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  {currentEmployee.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{currentEmployee.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      You ({currentEmployee.employeeCode})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {currentEmployee.jobTitle} • {currentEmployee.departmentName || "Engineering"}
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Current Position</span>
            </div>

            {/* Upward Manager Nodes */}
            {managerChain.map((mgr, idx) => (
              <React.Fragment key={mgr.id}>
                <div className="flex items-center justify-center py-0.5">
                  <div className="h-4 w-0.5 bg-slate-700" />
                </div>
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs">
                      {mgr.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{mgr.name}</span>
                        <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                          {mgr.employeeCode}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {mgr.jobTitle} • {mgr.departmentName || "Leadership"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-medium">
                    {idx === 0 ? "Direct Manager" : `Skip-Level (+${idx})`}
                  </span>
                </div>
              </React.Fragment>
            ))}

            {managerChain.length === 0 && (
              <div className="text-center py-4 text-xs text-slate-400">
                You are at the top level of the organization hierarchy.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
