"use client";

import React from "react";
import { GraduationCap } from "lucide-react";

export default function EmployeeTrainingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-[#36B4FF]" />
          My Training
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Assigned learning modules, data protection certifications, and healthcare workflow courses.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-slate-700 dark:text-slate-300 space-y-3 shadow-sm">
        <h3 className="font-semibold text-slate-900 dark:text-white">Active Courses</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          All annual compliance courses completed. Next refresher due in January 2027.
        </p>
      </div>
    </div>
  );
}

