"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  FileCheck,
  ShieldCheck,
  Eye,
} from "lucide-react";

interface EmployeeDocument {
  id: string;
  documentType: string;
  documentName: string;
  fileSize: number;
  mimeType: string;
  fileHash: string;
  version: number;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  verifiedByUserId?: string | null;
  verifiedAt?: number | null;
  rejectionReason?: string | null;
  status: string;
  createdAt: number;
}

interface DocumentVaultProps {
  employeeId: string;
  canUpload?: boolean;
  canVerify?: boolean;
}

export default function DocumentVault({
  employeeId,
  canUpload = true,
  canVerify = false,
}: DocumentVaultProps) {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("AADHAAR_ID");
  const [replacesDocId, setReplacesDocId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Verify modal state
  const [verifyingDoc, setVerifyingDoc] = useState<EmployeeDocument | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<"VERIFIED" | "REJECTED">("VERIFIED");
  const [rejectionReason, setRejectionReason] = useState("");
  const [submittingVerify, setSubmittingVerify] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/payrol/api/employees/${employeeId}/documents`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load documents");
      }
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("documentType", documentType);
      if (replacesDocId) {
        formData.append("replacesDocumentId", replacesDocId);
      }

      const res = await fetch(`/payrol/api/employees/${employeeId}/documents`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload document.");
      }

      setShowUploadModal(false);
      setSelectedFile(null);
      setReplacesDocId("");
      await fetchDocuments();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (docId: string, docName: string) => {
    try {
      const tokenRes = await fetch(`/payrol/api/documents/${docId}/token`, {
        method: "POST",
      });
      if (!tokenRes.ok) throw new Error("Could not authorize download");
      const tokenData = await tokenRes.json();

      // Trigger download
      window.open(tokenData.downloadUrl, "_blank");
    } catch {
      window.open(`/payrol/api/documents/${docId}/download`, "_blank");
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingDoc) return;
    if (verifyStatus === "REJECTED" && !rejectionReason.trim()) {
      alert("A rejection reason is required.");
      return;
    }

    setSubmittingVerify(true);
    try {
      const res = await fetch(`/payrol/api/documents/${verifyingDoc.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: verifyStatus,
          rejectionReason: verifyStatus === "REJECTED" ? rejectionReason.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update verification status");
      }

      setVerifyingDoc(null);
      setRejectionReason("");
      await fetchDocuments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingVerify(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> Verified
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Pending Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-[#293381] dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#36B4FF]" />
            Employee Document Vault
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Encrypted storage with magic-byte integrity validation & short-lived signed tokens.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDocuments()}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-xs"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {canUpload && (
            <button
              onClick={() => {
                setShowUploadModal(true);
                setReplacesDocId("");
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold transition shadow-sm"
            >
              <Plus className="w-4 h-4" /> Upload Document
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin text-[#293381] mx-auto" />
          <p className="text-xs text-slate-400 mt-2">Loading documents...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
          {error}
        </div>
      ) : documents.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No documents stored</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Upload identity proofs, educational certificates, appointment letters, or PAN/Tax records.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-[#36B4FF] shrink-0" />
                      <div>
                        <div className="font-semibold text-xs">{doc.documentName}</div>
                        <div className="font-mono text-[10px] text-slate-400 truncate max-w-[180px]">
                          SHA: {doc.fileHash?.slice(0, 16)}...
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {doc.documentType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono">
                      v{doc.version}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatFileSize(doc.fileSize)}</td>
                    <td className="px-4 py-3">
                      <div>
                        {getStatusBadge(doc.verificationStatus)}
                        {doc.rejectionReason && (
                          <div className="text-[10px] text-rose-500 mt-1 max-w-[200px]">
                            Reason: {doc.rejectionReason}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownload(doc.id, doc.documentName)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#36B4FF]/10 text-[#293381] dark:text-[#36B4FF] hover:bg-[#36B4FF]/20 font-semibold transition"
                          title="Download via Signed Token"
                        >
                          <Download className="w-3 h-3" /> Download
                        </button>
                        {canVerify && doc.verificationStatus === "PENDING" && (
                          <button
                            onClick={() => {
                              setVerifyingDoc(doc);
                              setVerifyStatus("VERIFIED");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold transition"
                          >
                            Review
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#293381] dark:text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#36B4FF]" />
              Upload Document to Vault
            </h3>

            {uploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Document Type
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                >
                  <option value="AADHAAR_ID">Aadhaar Card / National ID</option>
                  <option value="PAN_TAX_ID">PAN Card / Tax Identifier</option>
                  <option value="ADDRESS_PROOF">Address Proof / Passport</option>
                  <option value="APPOINTMENT_LETTER">Appointment / Offer Letter</option>
                  <option value="EMPLOYMENT_AGREEMENT">Employment Agreement</option>
                  <option value="EDUCATIONAL_CERTIFICATE">Educational Degree / Certificate</option>
                  <option value="EXPERIENCE_LETTER">Prior Experience Letter</option>
                  <option value="RELIEVING_LETTER">Relieving Letter</option>
                  <option value="SALARY_REVISION_LETTER">Salary Revision / Promotion Letter</option>
                  <option value="OTHER_HR_DOCUMENT">Other HR Document</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Choose File (PDF, PNG, JPEG, DOCX - max 10MB)
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#36B4FF]/10 file:text-[#293381] hover:file:bg-[#36B4FF]/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify / Reject Modal */}
      {verifyingDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#293381] dark:text-white">
              Verify Document: {verifyingDoc.documentName}
            </h3>

            <form onSubmit={handleVerifySubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Verification Decision
                </label>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="verifyStatus"
                      value="VERIFIED"
                      checked={verifyStatus === "VERIFIED"}
                      onChange={() => setVerifyStatus("VERIFIED")}
                      className="text-[#293381]"
                    />
                    <span className="font-semibold text-emerald-600">Approve / Verify</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="verifyStatus"
                      value="REJECTED"
                      checked={verifyStatus === "REJECTED"}
                      onChange={() => setVerifyStatus("REJECTED")}
                      className="text-rose-600"
                    />
                    <span className="font-semibold text-rose-600">Reject</span>
                  </label>
                </div>
              </div>

              {verifyStatus === "REJECTED" && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rejection Reason (Required)
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Document is expired, blurry, or missing signature..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifyingDoc(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingVerify}
                  className={`px-4 py-2 rounded-lg text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm ${
                    verifyStatus === "VERIFIED"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {submittingVerify ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Submit Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

