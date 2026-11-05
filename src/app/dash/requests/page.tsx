"use client";

import React from "react";
import { Inbox, Plus } from "lucide-react";

export default function EmployeeRequestsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Inbox className="w-6 h-6 text-emerald-400" />
            Module 9: My Requests
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Requisitions, HR letters, address updates, and helpdesk support tickets.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition">
          <Plus className="w-3.5 h-3.5" />
          <span>New Request</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-300 space-y-3">
        <h3 className="font-semibold text-white">Recent Requests</h3>
        <p className="text-xs text-slate-400">
          No open support tickets. All previous requests have been resolved.
        </p>
      </div>
    </div>
  );
}
