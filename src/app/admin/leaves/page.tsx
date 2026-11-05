"use client";

import React from "react";
import { CalendarDays } from "lucide-react";

export default function AdminLeavesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-indigo-400" />
          Leave & Holiday Management
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Annual leave accruals, casual & sick leaves, holiday calendars, and department-level approvals.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-300 space-y-3">
        <h3 className="font-semibold text-white">Leave Quotas & Policy Framework</h3>
        <p className="text-xs text-slate-400">
          Statutory leave policies, maternity/paternity tracking, comp-off credits, and carry-forward rules.
        </p>
      </div>
    </div>
  );
}

