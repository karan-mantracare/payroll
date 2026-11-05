"use client";

import React from "react";
import { CalendarCheck2 } from "lucide-react";

export default function AdminAttendancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <CalendarCheck2 className="w-6 h-6 text-indigo-400" />
          Module 4: Attendance Management
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Workforce attendance tracking, geo-fenced mobile punches, biometric sync, and regularization approvals.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-300 space-y-3">
        <h3 className="font-semibold text-white">Daily Attendance Monitor</h3>
        <p className="text-xs text-slate-400">
          Attendance engine tracking shifts, regularizations, and exceptions for all scoped departments.
        </p>
      </div>
    </div>
  );
}
