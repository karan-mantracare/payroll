"use client";

import React from "react";
import { Clock } from "lucide-react";

export default function EmployeeShiftsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Clock className="w-6 h-6 text-emerald-400" />
          Module 4: My Shifts
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Roster calendar, upcoming scheduled shifts, and shift swap requests with team peers.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-300 space-y-2">
        <h3 className="font-semibold text-white">Current Shift Schedule</h3>
        <p className="text-xs text-slate-400">
          General Shift: Monday – Friday (09:00 AM – 06:00 PM IST)
        </p>
      </div>
    </div>
  );
}
