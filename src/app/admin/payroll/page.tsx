"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Lock,
  AlertCircle,
  Eye,
  Download,
  Calendar,
  Building2,
  X,
  Printer,
  CheckCircle2,
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";

interface MonthlyPayrollCycle {
  month: string;
  period: string;
  headcount: number;
  totalGross: string;
  totalNet: string;
  totalDeductions: string;
  disbursedOn: string;
  status: "Completed" | "Processing" | "Draft";
}

const MONTHLY_PAYROLLS: MonthlyPayrollCycle[] = [
  {
    month: "October 2026",
    period: "01 Oct 2026 - 31 Oct 2026",
    headcount: 7,
    totalGross: "₹5,95,000",
    totalNet: "₹5,25,000",
    totalDeductions: "₹70,000",
    disbursedOn: "Oct 31, 2026",
    status: "Completed",
  },
  {
    month: "September 2026",
    period: "01 Sep 2026 - 30 Sep 2026",
    headcount: 7,
    totalGross: "₹5,95,000",
    totalNet: "₹5,25,000",
    totalDeductions: "₹70,000",
    disbursedOn: "Sep 30, 2026",
    status: "Completed",
  },
  {
    month: "August 2026",
    period: "01 Aug 2026 - 31 Aug 2026",
    headcount: 7,
    totalGross: "₹5,95,000",
    totalNet: "₹5,25,000",
    totalDeductions: "₹70,000",
    disbursedOn: "Aug 31, 2026",
    status: "Completed",
  },
];

export default function AdminPayrollPage() {
  const [selectedCycle, setSelectedCycle] = useState<MonthlyPayrollCycle | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const handleDownload = (cycle: MonthlyPayrollCycle) => {
    const summary = `================================================================================
                           MANTRACARE HRMS
                  ORGANIZATION MONTHLY PAYROLL REPORT
================================================================================
Payroll Cycle     : ${cycle.month}
Pay Period        : ${cycle.period}
Disbursement Date : ${cycle.disbursedOn}
Status            : ${cycle.status}
Eligible Employees: ${cycle.headcount}

FINANCIAL SUMMARY:
--------------------------------------------------------------------------------
Total Gross Pay   : ${cycle.totalGross}
Total Deductions  : ${cycle.totalDeductions}
Total Net Disbursed: ${cycle.totalNet}
Currency          : INR (₹)
Disbursement Mode : Direct Bank NEFT / RTGS
================================================================================
Generated securely by MantraCare HRMS Admin Portal.
================================================================================`;

    const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Payroll-Summary-${cycle.month.replace(/\s+/g, "-")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotification(`Monthly payroll report for ${cycle.month} downloaded successfully.`);
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-2">
          <Lock className="w-3.5 h-3.5" /> High Confidentiality Module
        </div>
        <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-[#36B4FF]" />
          Payroll Management
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Salary structures, pay components, statutory compliance (PF, ESI, TDS), and disbursement approvals.
        </p>
      </div>

      {notification && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#293381] dark:text-[#36B4FF] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[#293381] dark:text-[#36B4FF] text-sm">
              Phase 1 Architectural Shell Active
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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

      {/* Monthly Payroll Statements */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" />
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Monthly Payroll Statements</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Currency: INR (₹)</span>
        </div>

        <div className="space-y-2">
          {MONTHLY_PAYROLLS.map((cycle) => (
            <div
              key={cycle.month}
              className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg flex items-center justify-between border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white text-xs">{cycle.month}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {cycle.status}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Disbursed: {cycle.disbursedOn} • Headcount: {cycle.headcount} • Total Net: {cycle.totalNet}
                </div>
              </div>

              {/* 2 Buttons: View and Download */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCycle(cycle)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#293381] dark:text-[#36B4FF] border border-slate-300 dark:border-slate-600 text-xs font-semibold rounded transition shadow-sm"
                  title={`View ${cycle.month} statement`}
                >
                  <Eye className="w-3.5 h-3.5 text-[#293381] dark:text-[#36B4FF]" />
                  <span>View</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload(cycle)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold rounded transition shadow-sm"
                  title={`Download ${cycle.month} statement`}
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span className="text-white">Download</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Admin Statement Modal */}
      {selectedCycle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#293381] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">MantraCare HRMS — Monthly Payroll</h2>
                  <p className="text-xs text-white/80">{selectedCycle.period}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCycle(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Payroll Cycle</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{selectedCycle.month}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Eligible Headcount</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{selectedCycle.headcount} Employees</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Disbursed Date</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{selectedCycle.disbursedOn}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Disbursement Status</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{selectedCycle.status}</span>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                <div className="p-3 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Total Gross Pay</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-white">{selectedCycle.totalGross}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Total Statutory Deductions (PF, TDS, PT)</span>
                  <span className="font-mono font-medium text-rose-600 dark:text-rose-400">{selectedCycle.totalDeductions}</span>
                </div>
                <div className="p-3 flex justify-between bg-slate-50/70 dark:bg-slate-800/50 font-bold">
                  <span className="text-slate-800 dark:text-slate-100">Total Net Disbursed</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{selectedCycle.totalNet}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 text-xs font-semibold rounded-lg transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCycle(null)}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(selectedCycle)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold rounded-lg transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span className="text-white">Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
