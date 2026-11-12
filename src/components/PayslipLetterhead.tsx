"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Globe, Loader2, Mail, MapPin, Printer, ShieldCheck, X } from "lucide-react";

export async function downloadLetterheadPdf(
  payload: Record<string, unknown>,
  fileName: string
): Promise<void> {
  const res = await fetch("/payrol/api/payroll/payslip-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, fileName }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Failed to generate PDF");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface PayslipLetterheadModalProps {
  title: string;
  subtitle: string;
  documentTag?: string;
  onClose: () => void;
  onDownloadPdf?: () => void | Promise<void>;
  onDownloadFallback?: () => void;
  isDownloading?: boolean;
  downloadLabel?: string;
  children: React.ReactNode;
}

export function PayslipLetterheadModal({
  title,
  subtitle,
  documentTag = "OFFICIAL SALARY STATEMENT",
  onClose,
  onDownloadPdf,
  isDownloading = false,
  downloadLabel = "Download PDF",
  children,
}: PayslipLetterheadModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  if (!mounted) return null;

  return createPortal(
    <div
      id="mantracare-letterhead-portal"
      data-testid="payslip-letterhead-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body > *:not(#mantracare-letterhead-portal) {
            display: none !important;
          }
          #mantracare-letterhead-portal {
            position: static !important;
            inset: auto !important;
            display: block !important;
            background: #ffffff !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            width: 100% !important;
            height: auto !important;
          }
          #mantracare-letterhead-card {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .letterhead-no-print {
            display: none !important;
          }
          .letterhead-grid-2 {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 1rem !important;
          }
          .letterhead-grid-4 {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 0.75rem !important;
          }
        }
      `}</style>

      <div
        id="mantracare-letterhead-card"
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Official Letterhead Sheet */}
        <div className="bg-white text-slate-900 relative overflow-hidden">
          {/* Top Corporate Ribbon Header */}
          <div className="relative h-3 bg-[#cfe5f7] overflow-hidden">
            <div
              className="absolute right-0 top-0 h-full w-48 bg-gradient-to-r from-[#293381] via-[#293381] to-[#36B4FF]"
              style={{ clipPath: "polygon(12% 0, 100% 0, 100% 100%, 0% 100%)" }}
            />
          </div>

          {/* Letterhead Masthead */}
          <div className="px-6 pt-5 pb-4 border-b border-slate-200 bg-gradient-to-b from-slate-50/70 to-white">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <img
                  src="/payrol/mantracare-logo.png"
                  alt="MantraCare"
                  data-testid="letterhead-company-logo"
                  className="h-9 sm:h-10 w-auto object-contain"
                />
                <div className="space-y-0.5">
                  <p className="text-[11px] font-bold text-[#293381] tracking-wide uppercase">
                    Mantra Care Health Pvt. Ltd.
                  </p>
                  <p className="text-[10px] font-mono text-slate-500">
                    CIN: U85110DL2021PTC386439 &nbsp;|&nbsp; PAN: AAOCM9569M
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="text-right">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#293381] text-white text-[10px] font-bold tracking-wider uppercase">
                    {documentTag}
                  </span>
                  <h2 className="text-sm font-bold text-[#293381] mt-1.5">{title}</h2>
                  <p className="text-[11px] text-slate-500 font-medium">{subtitle}</p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close payslip modal"
                  className="letterhead-no-print p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Document Content Body */}
          <div className="p-6 space-y-5 text-sm">{children}</div>

          {/* Authorized Signatory Strip */}
          <div className="px-6 pb-4 pt-1 flex items-end justify-between gap-4">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Computer-generated salary statement verified via MantraCare HRMS.</span>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[11px] font-bold text-[#293381]">
                Mantra Care Health Pvt. Ltd.
              </div>
              <div className="mt-1 pt-1 border-t border-slate-300 text-[10px] font-semibold text-slate-500 tracking-wide uppercase">
                Authorized Signatory
              </div>
            </div>
          </div>

          {/* Bottom Corporate Letterhead Footer */}
          <div className="relative bg-[#eef6fc] border-t border-slate-200 px-6 py-3 flex items-center justify-between gap-2 text-[10px] text-slate-600">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-medium">
              <span className="inline-flex items-center gap-1 text-[#293381]">
                <Globe className="w-3 h-3 text-[#36B4FF]" />
                mantracare.org
              </span>
              <span className="inline-flex items-center gap-1 text-[#293381]">
                <Mail className="w-3 h-3 text-[#36B4FF]" />
                hr@mantracare.org
              </span>
            </div>
            <div className="inline-flex items-center gap-1 text-slate-600">
              <MapPin className="w-3 h-3 text-[#293381] shrink-0" />
              <span>A1/10, 3rd Floor, Paschim Vihar, Delhi - 110063</span>
            </div>
            <div
              className="absolute left-0 bottom-0 h-1.5 w-36 bg-gradient-to-r from-[#36B4FF] to-[#293381]"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Non-Printable Modal Footer Controls */}
        <div className="letterhead-no-print p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-transparent hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isDownloading}
              onClick={() => (onDownloadPdf ? void onDownloadPdf() : handlePrint())}
              data-testid="letterhead-download-pdf-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold rounded-lg transition shadow-sm disabled:opacity-60"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-white" />
              )}
              <span>{isDownloading ? "Generating PDF..." : downloadLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
