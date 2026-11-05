"use client";

import React from "react";
import { CreditCard, Download, ShieldCheck, Lock } from "lucide-react";

export default function EmployeePayrollPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-emerald-400" />
          My Payroll & Payslips
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Monthly salary statements, tax deduction breakdowns, and downloadable payslip PDFs.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-white text-sm">Recent Payslips</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Currency: INR (₹)</span>
        </div>

        <div className="space-y-2">
          {[
            { month: "October 2026", status: "Paid", date: "Oct 31, 2026" },
            { month: "September 2026", status: "Paid", date: "Sep 30, 2026" },
            { month: "August 2026", status: "Paid", date: "Aug 31, 2026" },
          ].map((p) => (
            <div key={p.month} className="p-3 bg-slate-800/40 rounded-lg flex items-center justify-between border border-slate-700/50">
              <div>
                <span className="font-medium text-white text-xs">{p.month}</span>
                <div className="text-[10px] text-slate-500">Credited: {p.date}</div>
              </div>
              <button className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition">
                <Download className="w-3 h-3" />
                <span>Download</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

