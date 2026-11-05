"use client";

import React from "react";
import { CheckSquare, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/AuthGate";

export default function EmployeeApprovalsPage() {
  const { hasPermission } = useAuth();
  const canManageApprovals = hasPermission("dash.team_approvals.manage");

  if (!canManageApprovals) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
        <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Module 11: Team Approvals (Permission Protected)</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          This module is reserved for Team Managers and HR holding the{" "}
          <code className="text-emerald-400 font-mono">dash.team_approvals.manage</code> permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <CheckSquare className="w-6 h-6 text-emerald-400" />
          Module 11: Team Approvals (Manager View)
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Review, approve, or reject subordinate leave applications, shift changes, and attendance regularizations.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-300 space-y-3">
        <h3 className="font-semibold text-white">Pending Team Requests</h3>
        <p className="text-xs text-slate-400">
          No pending team approvals at this time. All submissions from direct reports have been processed.
        </p>
      </div>
    </div>
  );
}

