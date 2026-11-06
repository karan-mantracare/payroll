"use client";

import React from "react";
import { Inbox, Plus } from "lucide-react";

export default function EmployeeRequestsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
            <Inbox className="w-6 h-6 text-[#36B4FF]" />
            My Requests
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Requisitions, HR letters, address updates, and helpdesk support tickets.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white transition shadow-sm">
          <Plus className="w-3.5 h-3.5 text-white" />
          <span className="text-white">New Request</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-slate-700 dark:text-slate-300 space-y-3 shadow-sm">
        <h3 className="font-semibold text-slate-900 dark:text-white">Recent Requests</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No open support tickets. All previous requests have been resolved.
        </p>
      </div>
    </div>
  );
}

