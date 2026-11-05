"use client";

import React from "react";
import { Clock } from "lucide-react";

export default function AdminShiftsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Clock className="w-6 h-6 text-indigo-400" />
          Module 5: Shift Management
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Shift rosters, rotation plans, night-shift allowances, and swap request workflows.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { name: "General Shift", time: "09:00 AM - 06:00 PM", count: "5 Employees" },
          { name: "Morning Support", time: "07:00 AM - 04:00 PM", count: "1 Employee" },
          { name: "Night Operations", time: "09:00 PM - 06:00 AM", count: "1 Employee" },
        ].map((s) => (
          <div key={s.name} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
            <h3 className="font-semibold text-white text-sm">{s.name}</h3>
            <div className="text-xs text-indigo-400 font-mono">{s.time}</div>
            <div className="text-xs text-slate-500 pt-2">{s.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
