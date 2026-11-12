"use client";

import {
  PayslipLetterheadModal,
  downloadLetterheadPdf,
} from "@/components/PayslipLetterhead";

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
  const [downloadingMonth, setDownloadingMonth] = useState<string | null>(null);

  const handleDownload = async (cycle: MonthlyPayrollCycle) => {
    setDownloadingMonth(cycle.month);
    try {
      await downloadLetterheadPdf(
        {
          kind: "admin",
          title: `Monthly Payroll — ${cycle.month}`,
          subtitle: cycle.period,
          documentTag: "CORPORATE PAYROLL STATEMENT",
          payrollCycle: cycle.month,
          headcount: cycle.headcount,
          disbursedDate: cycle.disbursedOn,
          status: cycle.status,
          totalGross: cycle.totalGross,
          totalDeductions: cycle.totalDeductions,
          totalNet: cycle.totalNet,
        },
        `Payroll-Summary-${cycle.month.replace(/\s+/g, "-")}`
      );
      setNotification(`Monthly payroll PDF for ${cycle.month} downloaded successfully.`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification(err?.message || `Failed to download payroll PDF for ${cycle.month}.`);
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setDownloadingMonth(null);
    }
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

              {/* 2 Buttons: View and Download (Icon Only) */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedCycle(cycle)}
                  className="p-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#293381] dark:text-[#36B4FF] border border-slate-300 dark:border-slate-600 rounded-lg transition shadow-sm flex items-center justify-center"
                  title={`View ${cycle.month} statement`}
                  aria-label={`View ${cycle.month} statement`}
                >
                  <Eye className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload(cycle)}
                  className="p-1.5 bg-[#293381] hover:bg-[#1F2664] text-white rounded-lg transition shadow-sm flex items-center justify-center"
                  title={`Download ${cycle.month} statement`}
                  aria-label={`Download ${cycle.month} statement`}
                >
                  <Download className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Admin Statement Modal */}
      {selectedCycle && (
        <PayslipLetterheadModal
          title={`Monthly Payroll — ${selectedCycle.month}`}
          subtitle={selectedCycle.period}
          documentTag="CORPORATE PAYROLL STATEMENT"
          onClose={() => setSelectedCycle(null)}
          onDownloadPdf={() => handleDownload(selectedCycle)}
          isDownloading={downloadingMonth === selectedCycle.month}
          downloadLabel="Download PDF"
        >
          <div className="letterhead-grid-2 grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Payroll Cycle</span>
              <span className="font-semibold text-slate-800">{selectedCycle.month}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Eligible Headcount</span>
              <span className="font-semibold text-slate-800">{selectedCycle.headcount} Employees</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Disbursed Date</span>
              <span className="font-semibold text-slate-800">{selectedCycle.disbursedOn}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Disbursement Status</span>
              <span className="font-semibold text-emerald-600">{selectedCycle.status}</span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
            <div className="p-3 flex justify-between">
              <span className="text-slate-600">Total Gross Pay</span>
              <span className="font-mono font-medium text-slate-900">{selectedCycle.totalGross}</span>
            </div>
            <div className="p-3 flex justify-between">
              <span className="text-slate-600">Total Statutory Deductions (PF, TDS, PT)</span>
              <span className="font-mono font-medium text-rose-600">{selectedCycle.totalDeductions}</span>
            </div>
            <div className="p-3 flex justify-between bg-slate-50 font-bold">
              <span className="text-slate-800">Total Net Disbursed</span>
              <span className="font-mono text-emerald-600">{selectedCycle.totalNet}</span>
            </div>
          </div>
        </PayslipLetterheadModal>
      )}
    </div>
  );
}
