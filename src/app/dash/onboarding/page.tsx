"use client";

import React from "react";
import { GitFork, CheckCircle2 } from "lucide-react";

export default function EmployeeOnboardingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <GitFork className="w-6 h-6 text-emerald-400" />
          Module 7: Onboarding & JML
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Checklist tasks, company handbook acknowledgment, IT asset allotment, and compliance sign-offs.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-300 space-y-3">
        <h3 className="font-semibold text-white">Onboarding Checklist</h3>
        <div className="space-y-2 text-xs">
          {[
            { task: "Identity Verification & Document Upload", status: "Completed" },
            { task: "Bank Account Details Submission", status: "Completed" },
            { task: "Information Security Policy Sign-off", status: "Completed" },
          ].map((t) => (
            <div key={t.task} className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg">
              <span className="text-slate-300">{t.task}</span>
              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
