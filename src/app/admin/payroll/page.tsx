"use client";

import React from "react";
import { CreditCard, Lock, ShieldCheck, AlertCircle } from "lucide-react";

export default function AdminPayrollPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-2">
          <Lock className="w-3.5 h-3.5" /> High Confidentiality Module
        </div>
        <h1 className="text-2xl font-bold text-[#293381] tracking-tight flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-[#36B4FF]" />
          Payroll Management
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Salary structures, pay components, statutory compliance (PF, ESI, TDS), and disbursement approvals.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#293381] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[#293381] text-sm">
              Phase 1 Architectural Shell Active
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Field-level data protection and sensitive redactions are enforced server-side.
              Per architectural specification, specific mathematical payroll calculation formulas and disbursement batch executions will be wired in Phase 2.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/50">
            <span className="text-xs text-slate-500 dark:text-slate-400">Current Payroll Cycle</span>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">November 2026</div>
            <span className="text-[11px] text-amber-500 dark:text-amber-400 font-mono">Status: Draft</span>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/50">
            <span className="text-xs text-slate-500 dark:text-slate-400">Scoped Headcount</span>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">7 Employees</div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">100% Eligible</span>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/50">
            <span className="text-xs text-slate-500 dark:text-slate-400">Disbursement Window</span>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">Nov 30, 2026</div>
            <span className="text-[11px] text-slate-500 font-mono">Locked</span>
          </div>
        </div>
      </div>
    </div>
  );
}

