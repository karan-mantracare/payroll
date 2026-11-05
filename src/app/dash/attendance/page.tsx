"use client";

import React from "react";
import { CalendarCheck2, Clock, CheckCircle } from "lucide-react";

export default function EmployeeAttendancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <CalendarCheck2 className="w-6 h-6 text-emerald-400" />
          Module 3: My Attendance
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Daily clock-in/out logs, work duration records, and attendance regularization requests.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm">Today&apos;s Attendance Punch</h3>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            Active Shift
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Clock in timestamp: <span className="font-mono text-white">09:02 AM IST</span> • Web Punch
        </p>
      </div>
    </div>
  );
}

