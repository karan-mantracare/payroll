"use client";

import React from "react";
import { GraduationCap } from "lucide-react";

export default function AdminTrainingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-[#36B4FF]" />
          Training Management
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Corporate training programs, HIPAA/GDPR compliance modules, technical certifications, and progress tracking.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-slate-700 dark:text-slate-300 space-y-3 shadow-sm">
        <h3 className="font-semibold text-slate-900 dark:text-white">Active Training Tracks</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Module-level training pathways and mandatory compliance courses for healthcare & tech staff.
        </p>
      </div>
    </div>
  );
}

