"use client";

import React from "react";
import { CheckSquare } from "lucide-react";

export default function AdminApprovalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <CheckSquare className="w-6 h-6 text-indigo-400" />
          Module 9: Approvals & Requests
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Centralized administrative approval queue for leave escalations, payroll revisions, and expense claims.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-300 space-y-3">
        <h3 className="font-semibold text-white">Pending Administrative Approvals</h3>
        <p className="text-xs text-slate-400">
          All pending requests within your authorized data scope are surfaced here for review.
        </p>
      </div>
    </div>
  );
}
