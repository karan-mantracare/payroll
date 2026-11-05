"use client";

import React from "react";
import { Sliders } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Sliders className="w-6 h-6 text-indigo-400" />
          Module 11: Organization Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Entity structures, legal corporate details, departments, office locations, and working calendar rules.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Entity Name", value: "MantraCare Global Technologies" },
          { label: "Registered Locations", value: "3 Locations (Delhi, BLR, Remote)" },
          { label: "Active Departments", value: "3 Departments (ENG, HR, FIN)" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
            <span className="text-xs text-slate-400">{s.label}</span>
            <div className="text-sm font-semibold text-white">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

