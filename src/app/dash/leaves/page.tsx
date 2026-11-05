"use client";

import React from "react";
import { CalendarDays } from "lucide-react";

export default function EmployeeLeavesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-emerald-400" />
          Module 5: My Leaves
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Apply for paid leaves, casual leaves, sick leave, and view upcoming holiday calendar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { type: "Privilege Leave", balance: "12 Days", used: "3 Days" },
          { type: "Casual Leave", balance: "6 Days", used: "1 Day" },
          { type: "Sick Leave", balance: "7 Days", used: "0 Days" },
        ].map((l) => (
          <div key={l.type} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
            <span className="text-xs text-slate-400">{l.type}</span>
            <div className="text-xl font-bold text-white">{l.balance}</div>
            <span className="text-[11px] text-slate-500 font-mono">Used: {l.used}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
