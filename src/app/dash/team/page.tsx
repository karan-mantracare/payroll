"use client";

import React, { useEffect, useState } from "react";
import { Users2, ShieldAlert, Loader2, Building, Mail } from "lucide-react";
import { useAuth } from "@/components/AuthGate";

export default function EmployeeTeamPage() {
  const { hasPermission, user } = useAuth();
  const canViewTeam = hasPermission("dash.team.view");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canViewTeam) return;

    fetch("/payrol/api/employees")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          // Filter to team members within scope
          setTeamMembers(data.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [canViewTeam]);

  if (!canViewTeam) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
        <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Module 10: My Team (Permission Protected)</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          This module is reserved for Team Managers, HR personnel, and Administrators holding the{" "}
          <code className="text-emerald-400 font-mono">dash.team.view</code> permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Users2 className="w-6 h-6 text-emerald-400" />
          Module 10: My Team (Manager View)
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Direct reports and team members under your supervision (Authorized Scope:{" "}
          <span className="font-mono text-emerald-400">{user?.widestScope}</span>)
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
          <span>Loading scoped team directory...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map((member) => (
            <div key={member.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-emerald-400">{member.id}</span>
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
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                Department: <span className="text-slate-300">{member.departmentName || "Engineering"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
