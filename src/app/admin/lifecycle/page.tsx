"use client";

import React from "react";
import { GitFork, CheckCircle, Clock } from "lucide-react";

export default function AdminLifecyclePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <GitFork className="w-6 h-6 text-indigo-400" />
          Module 3: Employee Lifecycle (JML)
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Joiner, Mover, Leaver transitions, onboarding workflows, probation tracking, and exit clearance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { step: "Joiner (Onboarding)", count: "2 Active", status: "In Progress" },
          { step: "Mover (Promotions/Transfers)", count: "1 Pending", status: "Review" },
          { step: "Leaver (Offboarding & Handover)", count: "0 Active", status: "Clear" },
        ].map((s) => (
          <div key={s.step} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
            <h3 className="font-semibold text-white text-sm">{s.step}</h3>
            <div className="text-xl font-bold text-indigo-400">{s.count}</div>
            <span className="text-[11px] text-slate-500 font-mono">Workflow Shell Active</span>
          </div>
        ))}
      </div>
    </div>
  );
}

