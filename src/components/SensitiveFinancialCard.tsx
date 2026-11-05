"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  Lock,
  Eye,
  EyeOff,
  Edit,
  Shield,
  Loader2,
  CheckCircle,
  Building2,
  DollarSign,
  FileBadge,
} from "lucide-react";

interface SensitiveDetailsProps {
  employeeId: string;
  canManage?: boolean;
}

export default function SensitiveFinancialCard({
  employeeId,
  canManage = false,
}: SensitiveDetailsProps) {
  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    basicSalary: "",
    grossSalary: "",
    netSalary: "",
    bankName: "",
    bankAccountNumber: "",
    bankIfsc: "",
    accountHolderName: "",
    taxIdentifier: "",
    compensationEffectiveDate: "",
  });

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/payrol/api/employees/${employeeId}/sensitive`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to load sensitive details");
      }
      const json = await res.json();
      setDetails(json.details);
      if (json.details) {
        setEditForm({
          basicSalary: typeof json.details.basicSalary === "number" ? String(json.details.basicSalary) : "",
          grossSalary: typeof json.details.grossSalary === "number" ? String(json.details.grossSalary) : "",
          netSalary: typeof json.details.netSalary === "number" ? String(json.details.netSalary) : "",
          bankName: json.details.bankName.includes("•") ? "" : json.details.bankName,
          bankAccountNumber: json.details.bankAccountNumber.includes("•") ? "" : json.details.bankAccountNumber,
          bankIfsc: json.details.bankIfsc.includes("•") ? "" : json.details.bankIfsc,
          accountHolderName: json.details.accountHolderName.includes("•") ? "" : json.details.accountHolderName,
          taxIdentifier: json.details.taxIdentifier.includes("•") ? "" : json.details.taxIdentifier,
          compensationEffectiveDate: json.details.compensationEffectiveDate || "",
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      const payload: Record<string, any> = {
        expectedUpdatedAt: details?.updatedAt,
      };

      if (editForm.basicSalary) payload.basicSalary = parseFloat(editForm.basicSalary);
      if (editForm.grossSalary) payload.grossSalary = parseFloat(editForm.grossSalary);
      if (editForm.netSalary) payload.netSalary = parseFloat(editForm.netSalary);
      if (editForm.bankName) payload.bankName = editForm.bankName;
      if (editForm.bankAccountNumber) payload.bankAccountNumber = editForm.bankAccountNumber;
      if (editForm.bankIfsc) payload.bankIfsc = editForm.bankIfsc;
      if (editForm.accountHolderName) payload.accountHolderName = editForm.accountHolderName;
      if (editForm.taxIdentifier) payload.taxIdentifier = editForm.taxIdentifier;
      if (editForm.compensationEffectiveDate) payload.compensationEffectiveDate = editForm.compensationEffectiveDate;

      const res = await fetch(`/payrol/api/employees/${employeeId}/sensitive`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update financial details");
      }

      setShowEditModal(false);
      await fetchDetails();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val: any) => {
    if (typeof val === "number") {
      return `₹${val.toLocaleString("en-IN")}`;
    }
    return val || "••••••••";
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-[#293381] dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#36B4FF]" />
              Sensitive Financial & Compensation Records
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Reversible AES-256-GCM encryption with field-level role-based redaction.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Shield className="w-3.5 h-3.5 text-emerald-600" /> AES-256-GCM ({details?.keyVersion || "v1"})
            </span>
            {canManage && (
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold transition shadow-sm"
              >
                <Edit className="w-3 h-3" /> Edit Financials
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#293381] mx-auto" />
            <p className="text-xs text-slate-400 mt-2">Loading encrypted records...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
            {error}
          </div>
        ) : !details ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No sensitive details configured.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Compensation Card */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-[#36B4FF]" /> Compensation Structure
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Basic Monthly Salary</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(details.basicSalary)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Gross Monthly Salary</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(details.grossSalary)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Net Take-Home Salary</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(details.netSalary)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Effective Date</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {details.compensationEffectiveDate || "Active"}
                  </span>
                </div>
              </div>
            </div>

            {/* Banking & Identity Card */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#36B4FF]" /> Banking & Tax ID Details
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Bank Name</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {details.bankName}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Account Number</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {details.bankAccountNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Bank IFSC</span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {details.bankIfsc}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Account Holder</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {details.accountHolderName}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Tax ID / PAN</span>
                  <span className="font-mono font-bold text-[#293381] dark:text-[#36B4FF]">
                    {details.taxIdentifier}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#293381] dark:text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#36B4FF]" />
              Update Sensitive Financial Details
            </h3>

            {saveError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {saveError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Basic Salary (₹)</label>
                  <input
                    type="number"
                    value={editForm.basicSalary}
                    onChange={(e) => setEditForm({ ...editForm, basicSalary: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gross Salary (₹)</label>
                  <input
                    type="number"
                    value={editForm.grossSalary}
                    onChange={(e) => setEditForm({ ...editForm, grossSalary: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Net Salary (₹)</label>
                  <input
                    type="number"
                    value={editForm.netSalary}
                    onChange={(e) => setEditForm({ ...editForm, netSalary: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={editForm.bankName}
                    onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={editForm.bankAccountNumber}
                    onChange={(e) => setEditForm({ ...editForm, bankAccountNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bank IFSC Code</label>
                  <input
                    type="text"
                    value={editForm.bankIfsc}
                    onChange={(e) => setEditForm({ ...editForm, bankIfsc: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PAN / Tax ID</label>
                  <input
                    type="text"
                    value={editForm.taxIdentifier}
                    onChange={(e) => setEditForm({ ...editForm, taxIdentifier: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  Save Encrypted
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
