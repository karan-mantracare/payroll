"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Download,
  Eye,
  Lock,
  Printer,
  X,
  CheckCircle2,
  Building2,
  FileText,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/components/AuthGate";

interface PayslipData {
  month: string;
  period: string;
  status: "Paid" | "Processing";
  date: string;
  gross: string;
  net: string;
  deductions: string;
  basic: string;
  hra: string;
  specialAllowance: string;
  conveyance: string;
  pf: string;
  tax: string;
  profTax: string;
}

const PAYSLIP_RECORDS: PayslipData[] = [
  {
    month: "October 2026",
    period: "01 Oct 2026 - 31 Oct 2026",
    status: "Paid",
    date: "Oct 31, 2026",
    gross: "₹85,000",
    net: "₹75,000",
    deductions: "₹10,000",
    basic: "₹45,000",
    hra: "₹22,500",
    specialAllowance: "₹15,000",
    conveyance: "₹2,500",
    pf: "₹5,400",
    tax: "₹4,400",
    profTax: "₹200",
  },
  {
    month: "September 2026",
    period: "01 Sep 2026 - 30 Sep 2026",
    status: "Paid",
    date: "Sep 30, 2026",
    gross: "₹85,000",
    net: "₹75,000",
    deductions: "₹10,000",
    basic: "₹45,000",
    hra: "₹22,500",
    specialAllowance: "₹15,000",
    conveyance: "₹2,500",
    pf: "₹5,400",
    tax: "₹4,400",
    profTax: "₹200",
  },
  {
    month: "August 2026",
    period: "01 Aug 2026 - 31 Aug 2026",
    status: "Paid",
    date: "Aug 31, 2026",
    gross: "₹85,000",
    net: "₹75,000",
    deductions: "₹10,000",
    basic: "₹45,000",
    hra: "₹22,500",
    specialAllowance: "₹15,000",
    conveyance: "₹2,500",
    pf: "₹5,400",
    tax: "₹4,400",
    profTax: "₹200",
  },
];

export default function EmployeePayrollPage() {
  const { user } = useAuth();
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const handleDownload = (p: PayslipData) => {
    const employeeName = user?.name || "Employee";
    const employeeCode = user?.employeeId || "EMP-908";

    const content = `================================================================================
                           MANTRACARE HRMS
                      MONTHLY SALARY STATEMENT
================================================================================
Pay Period       : ${p.period}
Disbursement Date: ${p.date}
Payment Status   : ${p.status}
Currency         : INR (₹)

EMPLOYEE DETAILS:
--------------------------------------------------------------------------------
Name             : ${employeeName}
Employee ID      : ${employeeCode}
Department       : Engineering
Designation      : Senior Member of Technical Staff
Bank Name        : HDFC Bank Limited
Bank Account     : •••• •••• 4892

EARNINGS BREAKDOWN:
--------------------------------------------------------------------------------
Basic Salary                             : ${p.basic}
House Rent Allowance (HRA)               : ${p.hra}
Special Allowance                        : ${p.specialAllowance}
Conveyance Allowance                     : ${p.conveyance}
--------------------------------------------------------------------------------
TOTAL GROSS EARNINGS                     : ${p.gross}

DEDUCTIONS BREAKDOWN:
--------------------------------------------------------------------------------
Provident Fund (Employee PF)             : ${p.pf}
Income Tax (TDS)                         : ${p.tax}
Professional Tax (PT)                    : ${p.profTax}
--------------------------------------------------------------------------------
TOTAL DEDUCTIONS                         : ${p.deductions}

NET PAY SUMMARY:
--------------------------------------------------------------------------------
NET TAKE-HOME PAY                        : ${p.net}
In Words: Seventy-Five Thousand Rupees Only
Disbursed To: HDFC Bank A/C ending in 4892

================================================================================
This is a secure system-generated payslip from MantraCare HRMS.
================================================================================`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Payslip-${p.month.replace(/\s+/g, "-")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotification(`Payslip for ${p.month} downloaded successfully.`);
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-[#36B4FF]" />
          My Payroll & Payslips
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Monthly salary statements, tax deduction breakdowns, and downloadable payslip PDFs.
        </p>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Payslips Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#293381] dark:text-emerald-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Recent Payslips</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Currency: INR (₹)</span>
        </div>

        <div className="space-y-2">
          {PAYSLIP_RECORDS.map((p) => (
            <div
              key={p.month}
              className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg flex items-center justify-between border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white text-xs">{p.month}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {p.status}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Credited: {p.date}</div>
              </div>

              {/* 2 Buttons: View and Download */}
              <div className="flex items-center gap-2">
                {/* View Button */}
                <button
                  type="button"
                  onClick={() => setSelectedPayslip(p)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#293381] dark:text-[#36B4FF] border border-slate-300 dark:border-slate-600 text-xs font-semibold rounded transition shadow-sm"
                  title={`View ${p.month} payslip`}
                >
                  <Eye className="w-3.5 h-3.5 text-[#293381] dark:text-[#36B4FF]" />
                  <span>View</span>
                </button>

                {/* Download Button */}
                <button
                  type="button"
                  onClick={() => handleDownload(p)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold rounded transition shadow-sm"
                  title={`Download ${p.month} payslip`}
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span className="text-white">Download</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payslip View Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#293381] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">MantraCare HRMS — Payslip</h2>
                  <p className="text-xs text-white/80">Pay Period: {selectedPayslip.period}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayslip(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 text-sm">
              {/* Employee & Disbursal Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/50 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Employee</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{user?.name || "Admin Mantra"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Employee ID</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                    {user?.employeeId || "EMP-908"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Disbursed Date</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{selectedPayslip.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Status</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> {selectedPayslip.status}
                  </span>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Earnings */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 dark:bg-slate-800 px-3.5 py-2 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-600" /> Earnings
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">Amount</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    <div className="p-2.5 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Basic Salary</span>
                      <span className="font-mono font-medium text-slate-900 dark:text-white">{selectedPayslip.basic}</span>
                    </div>
                    <div className="p-2.5 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-300">House Rent Allowance (HRA)</span>
                      <span className="font-mono font-medium text-slate-900 dark:text-white">{selectedPayslip.hra}</span>
                    </div>
                    <div className="p-2.5 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Special Allowance</span>
                      <span className="font-mono font-medium text-slate-900 dark:text-white">
                        {selectedPayslip.specialAllowance}
                      </span>
                    </div>
                    <div className="p-2.5 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Conveyance Allowance</span>
                      <span className="font-mono font-medium text-slate-900 dark:text-white">
                        {selectedPayslip.conveyance}
                      </span>
                    </div>
                    <div className="p-2.5 flex justify-between bg-slate-50/70 dark:bg-slate-800/50 font-semibold">
                      <span className="text-slate-800 dark:text-slate-100">Total Gross</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">{selectedPayslip.gross}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 dark:bg-slate-800 px-3.5 py-2 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <ArrowDownCircle className="w-3.5 h-3.5 text-rose-600" /> Deductions
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">Amount</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    <div className="p-2.5 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Provident Fund (PF)</span>
                      <span className="font-mono font-medium text-slate-900 dark:text-white">{selectedPayslip.pf}</span>
                    </div>
                    <div className="p-2.5 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Income Tax (TDS)</span>
                      <span className="font-mono font-medium text-slate-900 dark:text-white">{selectedPayslip.tax}</span>
                    </div>
                    <div className="p-2.5 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Professional Tax (PT)</span>
                      <span className="font-mono font-medium text-slate-900 dark:text-white">
                        {selectedPayslip.profTax}
                      </span>
                    </div>
                    <div className="p-2.5 flex justify-between opacity-0 select-none">
                      <span>Spacer</span>
                      <span>-</span>
                    </div>
                    <div className="p-2.5 flex justify-between bg-slate-50/70 dark:bg-slate-800/50 font-semibold">
                      <span className="text-slate-800 dark:text-slate-100">Total Deductions</span>
                      <span className="font-mono text-rose-600 dark:text-rose-400">{selectedPayslip.deductions}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Pay Highlight Card */}
              <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide block">
                    Net Take-Home Salary
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Disbursed to HDFC Bank A/C ending in 4892
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {selectedPayslip.net}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Seventy-Five Thousand Only</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 text-xs font-semibold rounded-lg transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPayslip(null)}
                  className="px-3 py-1.5 bg-transparent hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(selectedPayslip)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold rounded-lg transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span className="text-white">Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
