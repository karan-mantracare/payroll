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
import {
  PayslipLetterheadModal,
  downloadLetterheadPdf,
} from "@/components/PayslipLetterhead";

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
  const [downloadingMonth, setDownloadingMonth] = useState<string | null>(null);

  const handleDownload = async (p: PayslipData) => {
    const employeeName = user?.name || "Admin Mantra";
    const employeeCode = user?.employeeId || "EMP-008";

    setDownloadingMonth(p.month);
    try {
      await downloadLetterheadPdf(
        {
          kind: "employee",
          title: `Payslip — ${p.month}`,
          subtitle: `Pay Period: ${p.period}`,
          documentTag: "MONTHLY SALARY STATEMENT",
          employeeName,
          employeeCode,
          disbursedDate: p.date,
          status: p.status,
          basic: p.basic,
          hra: p.hra,
          specialAllowance: p.specialAllowance,
          conveyance: p.conveyance,
          gross: p.gross,
          pf: p.pf,
          tax: p.tax,
          profTax: p.profTax,
          deductions: p.deductions,
          net: p.net,
        },
        `Payslip-${p.month.replace(/\s+/g, "-")}`
      );
      setNotification(`Payslip PDF for ${p.month} downloaded successfully.`);
      setTimeout(() => {
        setNotification(null);
      }, 4000);
    } catch (err: any) {
      setNotification(err?.message || `Failed to download payslip for ${p.month}.`);
      setTimeout(() => {
        setNotification(null);
      }, 4000);
    } finally {
      setDownloadingMonth(null);
    }
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

              {/* 2 Buttons: View and Download (Icon Only) */}
              <div className="flex items-center gap-1.5">
                {/* View Button */}
                <button
                  type="button"
                  onClick={() => setSelectedPayslip(p)}
                  className="p-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#293381] dark:text-[#36B4FF] border border-slate-300 dark:border-slate-600 rounded-lg transition shadow-sm flex items-center justify-center"
                  title={`View ${p.month} payslip`}
                  aria-label={`View ${p.month} payslip`}
                >
                  <Eye className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" />
                </button>

                {/* Download Button */}
                <button
                  type="button"
                  onClick={() => handleDownload(p)}
                  className="p-1.5 bg-[#293381] hover:bg-[#1F2664] text-white rounded-lg transition shadow-sm flex items-center justify-center"
                  title={`Download ${p.month} payslip`}
                  aria-label={`Download ${p.month} payslip`}
                >
                  <Download className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payslip View Modal */}
      {selectedPayslip && (
        <PayslipLetterheadModal
          title={`Payslip — ${selectedPayslip.month}`}
          subtitle={`Pay Period: ${selectedPayslip.period}`}
          documentTag="MONTHLY SALARY STATEMENT"
          onClose={() => setSelectedPayslip(null)}
          onDownloadPdf={() => handleDownload(selectedPayslip)}
          isDownloading={downloadingMonth === selectedPayslip.month}
          downloadLabel="Download PDF"
        >
          {/* Employee & Disbursal Details */}
          <div className="letterhead-grid-4 grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Employee</span>
              <span className="font-semibold text-slate-800">{user?.name || "Admin Mantra"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Employee ID</span>
              <span className="font-mono font-semibold text-slate-800">
                {user?.employeeId || "EMP-908"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Disbursed Date</span>
              <span className="font-semibold text-slate-800">{selectedPayslip.date}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Status</span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                <CheckCircle2 className="w-3 h-3" /> {selectedPayslip.status}
              </span>
            </div>
          </div>

          {/* Earnings & Deductions Tables */}
          <div className="letterhead-grid-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Earnings */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-3.5 py-2 flex items-center justify-between border-b border-slate-200">
                <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                  <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-600" /> Earnings
                </span>
                <span className="text-[11px] font-semibold text-slate-500">Amount</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="p-2.5 flex justify-between">
                  <span className="text-slate-600">Basic Salary</span>
                  <span className="font-mono font-medium text-slate-900">{selectedPayslip.basic}</span>
                </div>
                <div className="p-2.5 flex justify-between">
                  <span className="text-slate-600">House Rent Allowance (HRA)</span>
                  <span className="font-mono font-medium text-slate-900">{selectedPayslip.hra}</span>
                </div>
                <div className="p-2.5 flex justify-between">
                  <span className="text-slate-600">Special Allowance</span>
                  <span className="font-mono font-medium text-slate-900">
                    {selectedPayslip.specialAllowance}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between">
                  <span className="text-slate-600">Conveyance Allowance</span>
                  <span className="font-mono font-medium text-slate-900">
                    {selectedPayslip.conveyance}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between bg-slate-50 font-semibold">
                  <span className="text-slate-800">Total Gross</span>
                  <span className="font-mono text-emerald-600">{selectedPayslip.gross}</span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-3.5 py-2 flex items-center justify-between border-b border-slate-200">
                <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                  <ArrowDownCircle className="w-3.5 h-3.5 text-rose-600" /> Deductions
                </span>
                <span className="text-[11px] font-semibold text-slate-500">Amount</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="p-2.5 flex justify-between">
                  <span className="text-slate-600">Provident Fund (PF)</span>
                  <span className="font-mono font-medium text-slate-900">{selectedPayslip.pf}</span>
                </div>
                <div className="p-2.5 flex justify-between">
                  <span className="text-slate-600">Income Tax (TDS)</span>
                  <span className="font-mono font-medium text-slate-900">{selectedPayslip.tax}</span>
                </div>
                <div className="p-2.5 flex justify-between">
                  <span className="text-slate-600">Professional Tax (PT)</span>
                  <span className="font-mono font-medium text-slate-900">
                    {selectedPayslip.profTax}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between opacity-0 select-none">
                  <span>Spacer</span>
                  <span>-</span>
                </div>
                <div className="p-2.5 flex justify-between bg-slate-50 font-semibold">
                  <span className="text-slate-800">Total Deductions</span>
                  <span className="font-mono text-rose-600">{selectedPayslip.deductions}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Pay Highlight Card */}
          <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide block">
                Net Take-Home Salary
              </span>
              <span className="text-[11px] text-slate-500">
                Disbursed to HDFC Bank A/C ending in 4892
              </span>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-600 font-mono">
                {selectedPayslip.net}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Seventy-Five Thousand Only</span>
            </div>
          </div>
        </PayslipLetterheadModal>
      )}
    </div>
  );
}
