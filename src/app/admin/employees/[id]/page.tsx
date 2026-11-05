"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Briefcase,
  Building,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Clock,
  Shield,
  Edit,
  ArrowRightCircle,
  AlertCircle,
  Loader2,
  X,
  History,
  CheckCircle2,
  Network,
  Users2,
  ChevronRight,
  ChevronDown,
  UserCheck,
  Search,
  RefreshCw,
  GitCommit,
  FileText,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import DocumentVault from "@/components/DocumentVault";
import SensitiveFinancialCard from "@/components/SensitiveFinancialCard";

interface HierarchyNode {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  jobTitle: string;
  departmentName?: string | null;
  locationName?: string | null;
  status: string;
  managerId: string | null;
  directReportsCount: number;
  depth: number;
  children?: HierarchyNode[];
}

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const [employee, setEmployee] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "hierarchy" | "documents" | "financials">("details");

  // Hierarchy Data State
  const [hierarchyData, setHierarchyData] = useState<{
    tree: HierarchyNode | null;
    managerChain: any[];
    directReports: any[];
    history: any[];
  } | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchySearch, setHierarchySearch] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Change Manager Modal State
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [managerCandidates, setManagerCandidates] = useState<any[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");
  const [managerReason, setManagerReason] = useState("");
  const [managerEffectiveDate, setManagerEffectiveDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [managerValidation, setManagerValidation] = useState<{ valid: boolean; error?: string } | null>(null);
  const [validatingManager, setValidatingManager] = useState(false);
  const [submittingManager, setSubmittingManager] = useState(false);
  const [managerError, setManagerError] = useState<string | null>(null);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    jobTitle: "",
    departmentId: "",
    locationId: "",
    employmentType: "FULL_TIME",
    probationStatus: "CONFIRMED",
    phone: "",
    personalEmail: "",
    dateOfBirth: "",
    gender: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });

  // Status Transition Modal State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusForm, setStatusForm] = useState({
    newStatus: "ON_LEAVE",
    reason: "",
    effectiveDate: new Date().toISOString().split("T")[0],
  });

  const fetchEmployee = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/payrol/api/employees/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Employee not found or outside your data scope.");
        throw new Error("Failed to load employee details.");
      }
      const json = await res.json();
      setEmployee(json.data);

      // Pre-fill edit form
      setEditForm({
        name: json.data.name || "",
        jobTitle: json.data.jobTitle || "",
        departmentId: json.data.departmentId || "",
        locationId: json.data.locationId || "",
        employmentType: json.data.employmentType || "FULL_TIME",
        probationStatus: json.data.probationStatus || "CONFIRMED",
        phone: json.data.phone || "",
        personalEmail: json.data.personalEmail || "",
        dateOfBirth: json.data.dateOfBirth || "",
        gender: json.data.gender || "",
        emergencyContactName: json.data.emergencyContactName || "",
        emergencyContactPhone: json.data.emergencyContactPhone || "",
      });

      setStatusForm({
        newStatus: json.data.status === "ACTIVE" ? "ON_LEAVE" : "ACTIVE",
        reason: "",
        effectiveDate: new Date().toISOString().split("T")[0],
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHierarchy = async () => {
    setHierarchyLoading(true);
    try {
      const res = await fetch(`/payrol/api/hierarchy/${id}`);
      if (res.ok) {
        const json = await res.json();
        setHierarchyData(json);
        // Expand root by default
        if (json.tree) {
          setExpandedNodes((prev) => ({ ...prev, [json.tree.id]: true }));
        }
      }
    } catch {
      // Ignore hierarchy loading errors gracefully
    } finally {
      setHierarchyLoading(false);
    }
  };

  const fetchManagerCandidates = async () => {
    try {
      const res = await fetch(`/payrol/api/employees?pageSize=100&status=ACTIVE`);
      if (res.ok) {
        const json = await res.json();
        // Exclude current employee
        setManagerCandidates(
          (json.data || []).filter((e: any) => e.id !== id && e.employeeCode !== id)
        );
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchEmployee();
  }, [id]);

  useEffect(() => {
    if (activeTab === "hierarchy") {
      fetchHierarchy();
    }
  }, [activeTab, id]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  // Pre-flight manager validation
  const validateCandidate = async (candidateId: string) => {
    setSelectedManagerId(candidateId);
    setManagerValidation(null);
    setManagerError(null);

    if (!candidateId) {
      setManagerValidation({ valid: true });
      return;
    }

    setValidatingManager(true);
    try {
      const res = await fetch("/payrol/api/hierarchy/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee?.id || id,
          candidateManagerId: candidateId,
        }),
      });
      const data = await res.json();
      setManagerValidation(data);
    } catch (err: any) {
      setManagerValidation({ valid: false, error: "Network error validating manager." });
    } finally {
      setValidatingManager(false);
    }
  };

  const handleChangeManagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerReason.trim()) {
      setManagerError("Please provide a reason for changing the reporting manager.");
      return;
    }

    setSubmittingManager(true);
    setManagerError(null);

    try {
      const res = await fetch(`/payrol/api/hierarchy/${id}/change-manager`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newManagerId: selectedManagerId || null,
          reason: managerReason,
          effectiveDate: managerEffectiveDate,
          concurrencyVersion: employee.concurrencyVersion,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update reporting manager.");
      }

      setShowManagerModal(false);
      setManagerReason("");
      setSelectedManagerId("");
      await fetchEmployee();
      await fetchHierarchy();
    } catch (err: any) {
      setManagerError(err.message);
    } finally {
      setSubmittingManager(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setEditError(null);

    try {
      const res = await fetch(`/payrol/api/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          concurrencyVersion: employee.concurrencyVersion,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update employee.");
      }

      setShowEditModal(false);
      await fetchEmployee();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusForm.reason.trim()) {
      setStatusError("Please provide a detailed reason for the status transition.");
      return;
    }

    setTransitioning(true);
    setStatusError(null);

    try {
      const res = await fetch(`/payrol/api/employees/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...statusForm,
          concurrencyVersion: employee.concurrencyVersion,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to transition employee status.");
      }

      setShowStatusModal(false);
      await fetchEmployee();
    } catch (err: any) {
      setStatusError(err.message);
    } finally {
      setTransitioning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "ON_LEAVE":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "PROBATION":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "SUSPENDED":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "TERMINATED":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  // Render tree node recursive component
  const renderTreeNode = (node: HierarchyNode) => {
    const isExpanded = expandedNodes[node.id];
    const isCurrent = node.id === employee?.id || node.employeeCode === employee?.employeeCode;
    const hasChildren = node.children && node.children.length > 0;
    const matchesSearch =
      hierarchySearch.trim() === "" ||
      node.name.toLowerCase().includes(hierarchySearch.toLowerCase()) ||
      node.jobTitle.toLowerCase().includes(hierarchySearch.toLowerCase()) ||
      node.employeeCode.toLowerCase().includes(hierarchySearch.toLowerCase());

    return (
      <div key={node.id} className="space-y-2">
        <div
          className={`flex items-center justify-between p-3 rounded-lg border transition ${
            isCurrent
              ? "bg-[#EBF7FF] dark:bg-slate-800 border-[#36B4FF] shadow-sm text-[#293381]"
              : matchesSearch
              ? "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 hover:border-[#36B4FF]"
              : "opacity-40 bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {hasChildren ? (
              <button
                onClick={() => toggleNode(node.id)}
                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-[#293381] dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-5" />
            )}

            <div className="w-8 h-8 rounded-full bg-[#293381]/10 text-[#293381] dark:bg-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
              {node.name.charAt(0)}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-[#293381] dark:text-white truncate">{node.name}</span>
                <span className="font-mono text-[10px] text-[#36B4FF] font-bold">
                  {node.employeeCode}
                </span>
                {isCurrent && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#36B4FF]/20 text-[#293381] dark:text-[#36B4FF] border border-[#36B4FF]/40">
                    Viewing
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {node.jobTitle} • {node.departmentName || "Engineering"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {node.directReportsCount} Direct Reports
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusBadge(node.status)}`}>
              {node.status}
            </span>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="pl-6 border-l-2 border-[#293381]/20 dark:border-slate-800 ml-4 space-y-2">
            {node.children!.map((child) => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center flex-col gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#293381] dark:text-[#36B4FF]" />
        <p className="text-xs text-slate-400">Loading employee master record...</p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl p-8 text-center max-w-lg mx-auto space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Employee Detail Unavailable</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">{error || "Employee not found."}</p>
        <Link
          href="/admin/employees"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Employee Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/employees"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#293381] dark:hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Employee Directory
        </Link>
        <div className="text-xs text-slate-400 font-mono">
          Concurrency Version: <span className="text-[#293381] dark:text-[#36B4FF] font-bold">{employee.concurrencyVersion}</span>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#293381] to-[#36B4FF] flex items-center justify-center text-white text-xl font-bold shadow-md">
              {employee.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-[#293381] dark:text-white">{employee.name}</h1>
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-[#293381]/10 text-[#293381] dark:text-[#36B4FF] border border-[#293381]/20">
                  {employee.employeeCode}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(
                    employee.status
                  )}`}
                >
                  {employee.status}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
                {employee.jobTitle} • {employee.departmentName || "Engineering"}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> {employee.email}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {employee.locationName || "HQ"}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Joined {employee.joinedDate}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={() => {
                fetchManagerCandidates();
                setShowManagerModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#36B4FF]/30 bg-[#36B4FF]/10 hover:bg-[#36B4FF]/20 text-[#293381] dark:text-[#36B4FF] text-xs font-semibold transition"
            >
              <Network className="w-3.5 h-3.5" /> Change Manager
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
            >
              <Edit className="w-3.5 h-3.5" /> Edit Profile
            </button>
            <button
              onClick={() => setShowStatusModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold transition shadow-sm"
            >
              <ArrowRightCircle className="w-3.5 h-3.5" /> Change Status
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-6 mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            onClick={() => setActiveTab("details")}
            className={`pb-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "details"
                ? "border-[#293381] text-[#293381] dark:border-[#36B4FF] dark:text-[#36B4FF]"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <User className="w-3.5 h-3.5" /> Master Details & Personal
          </button>
          <button
            onClick={() => setActiveTab("hierarchy")}
            className={`pb-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "hierarchy"
                ? "border-[#293381] text-[#293381] dark:border-[#36B4FF] dark:text-[#36B4FF]"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <Network className="w-3.5 h-3.5" /> Reporting Hierarchy & Tree
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`pb-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "documents"
                ? "border-[#293381] text-[#293381] dark:border-[#36B4FF] dark:text-[#36B4FF]"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Document Vault
          </button>
          <button
            onClick={() => setActiveTab("financials")}
            className={`pb-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "financials"
                ? "border-[#293381] text-[#293381] dark:border-[#36B4FF] dark:text-[#36B4FF]"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" /> Sensitive Financials
          </button>
        </div>
      </div>

      {/* Tab 1: Details View */}
      {activeTab === "details" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Employment Details Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" /> Employment Master Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Immutable Employee ID</span>
                  <span className="font-mono font-bold text-sm text-[#293381] dark:text-[#36B4FF]">
                    {employee.employeeCode}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Internal Primary Key UUID</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300 text-[11px] truncate block">
                    {employee.id}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Employment Type</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{employee.employmentType}</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Probation Status</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{employee.probationStatus}</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Department & Team</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {employee.departmentName || "General"} {employee.teamName ? `• ${employee.teamName}` : ""}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Location Center</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {employee.locationName || "HQ"}
                  </span>
                </div>
              </div>
            </div>

            {/* Personal Contacts */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" /> Personal & Emergency Contacts
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Phone Number</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{employee.phone || "Not specified"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Personal Email</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{employee.personalEmail || "Not specified"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Emergency Contact Person</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{employee.emergencyContactName || "Not specified"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Emergency Contact Phone</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{employee.emergencyContactPhone || "Not specified"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Reporting Line & Status History */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" /> Reporting Line
                </h2>
                <button
                  onClick={() => {
                    fetchManagerCandidates();
                    setShowManagerModal(true);
                  }}
                  className="text-xs text-[#293381] dark:text-[#36B4FF] hover:underline font-semibold"
                >
                  Change
                </button>
              </div>

              {employee.manager ? (
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Direct Reporting Manager
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white text-sm">{employee.manager.name}</div>
                  <div className="text-xs text-[#293381] dark:text-[#36B4FF] font-mono mt-0.5">
                    {employee.manager.employeeCode}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{employee.manager.jobTitle}</div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-400">
                  Top of organization (No reporting manager assigned)
                </div>
              )}
            </div>

            {/* Status History Timeline */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <History className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" /> Status Transitions
              </h2>
              {employee.statusHistory && employee.statusHistory.length > 0 ? (
                <div className="space-y-3">
                  {employee.statusHistory.map((h: any) => (
                    <div key={h.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {h.previousStatus} → <span className="text-[#293381] dark:text-[#36B4FF] font-semibold">{h.newStatus}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{h.effectiveDate}</span>
                      </div>
                      <p className="text-slate-500 text-[11px]">{h.reason}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-slate-400">No transitions recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Reporting Hierarchy & Interactive Organizational Tree */}
      {activeTab === "hierarchy" && (
        <div className="space-y-6">
          {/* Top Row: Direct Manager & Upward Chain Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Direct Manager Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" /> Direct Reporting Manager
                </h3>
                <button
                  onClick={() => {
                    fetchManagerCandidates();
                    setShowManagerModal(true);
                  }}
                  className="text-xs text-[#293381] dark:text-[#36B4FF] font-semibold hover:underline"
                >
                  Edit Manager
                </button>
              </div>

              {employee.manager ? (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{employee.manager.name}</div>
                  <div className="text-xs font-mono text-[#293381] dark:text-[#36B4FF] font-semibold">
                    {employee.manager.employeeCode}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{employee.manager.jobTitle}</div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-400">
                  Top-level executive (Reports directly to Board / No manager assigned)
                </div>
              )}
            </div>

            {/* Upward Leadership Chain */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <GitCommit className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" /> Upward Leadership Chain
              </h3>

              {hierarchyLoading ? (
                <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#293381] dark:text-[#36B4FF]" />
                  <span>Tracing manager chain...</span>
                </div>
              ) : hierarchyData?.managerChain && hierarchyData.managerChain.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-3 py-2 rounded-lg bg-[#EBF7FF] dark:bg-[#293381]/20 border border-[#36B4FF]/30 text-xs">
                    <span className="font-bold text-[#293381] dark:text-[#36B4FF]">{employee.name}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">Self</span>
                  </div>

                  {hierarchyData.managerChain.map((mgr, idx) => (
                    <React.Fragment key={mgr.id}>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{mgr.name}</span>
                        <span className="text-[10px] text-slate-400 block">{mgr.jobTitle}</span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  No upward chain (Top of organization hierarchy).
                </div>
              )}
            </div>
          </div>

          {/* Subordinate Organizational Tree */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Network className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" /> Organizational Subtree & Direct Reports
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Expand and collapse subordinate reporting lines beneath {employee.name}.
                </p>
              </div>

              {/* Hierarchy Tree Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter hierarchy tree..."
                  value={hierarchySearch}
                  onChange={(e) => setHierarchySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#36B4FF]"
                />
              </div>
            </div>

            {hierarchyLoading ? (
              <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#293381] dark:text-[#36B4FF]" />
                <span>Loading hierarchical tree...</span>
              </div>
            ) : hierarchyData?.tree ? (
              <div className="pt-2">{renderTreeNode(hierarchyData.tree)}</div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">No hierarchy data available.</div>
            )}
          </div>

          {/* Reporting Manager Change History Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" /> Reporting Manager Change History
            </h3>

            {hierarchyData?.history && hierarchyData.history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Effective Date</th>
                      <th className="py-2.5 px-3">Previous Manager</th>
                      <th className="py-2.5 px-3">New Manager</th>
                      <th className="py-2.5 px-3">Reason</th>
                      <th className="py-2.5 px-3">Changed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                    {hierarchyData.history.map((h: any) => (
                      <tr key={h.id} className="hover:bg-[#EBF7FF]/40 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{h.effectiveDate}</td>
                        <td className="py-2.5 px-3">
                          {h.previousManagerName ? (
                            <span>
                              {h.previousManagerName}{" "}
                              <span className="font-mono text-[10px] text-slate-400">({h.previousManagerCode})</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">None (Top Level)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {h.newManagerName ? (
                            <span className="text-[#293381] dark:text-[#36B4FF] font-semibold">
                              {h.newManagerName}{" "}
                              <span className="font-mono text-[10px] text-[#36B4FF]">({h.newManagerCode})</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">None (Top Level)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">{h.reason}</td>
                        <td className="py-2.5 px-3 text-slate-400">{h.changedByUserName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">
                No manager change events recorded in history yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHANGE REPORTING MANAGER MODAL */}
      {showManagerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-[#293381] dark:text-[#36B4FF]" />
                Change Reporting Manager
              </h2>
              <button
                onClick={() => setShowManagerModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {managerError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{managerError}</span>
              </div>
            )}

            <form onSubmit={handleChangeManagerSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select New Reporting Manager
                </label>
                <select
                  value={selectedManagerId}
                  onChange={(e) => validateCandidate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                >
                  <option value="">-- No Manager (Top-Level Executive) --</option>
                  {managerCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.employeeCode}) — {c.jobTitle}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pre-flight validation status */}
              {validatingManager && (
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-[11px] text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#293381] dark:text-[#36B4FF]" />
                  <span>Validating hierarchy cycle detection & rules...</span>
                </div>
              )}

              {managerValidation && !managerValidation.valid && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{managerValidation.error}</span>
                </div>
              )}

              {managerValidation && managerValidation.valid && selectedManagerId && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Valid hierarchy assignment. No circular dependency detected.</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Effective Date *
                </label>
                <input
                  type="date"
                  required
                  value={managerEffectiveDate}
                  onChange={(e) => setManagerEffectiveDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Manager Change *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Promotion, department reorganization, manager transition..."
                  value={managerReason}
                  onChange={(e) => setManagerReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManagerModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingManager || (managerValidation !== null && !managerValidation.valid)}
                  className="px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white font-semibold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {submittingManager && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Manager Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-[#293381] dark:text-[#36B4FF]" />
                Edit Employee Details
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={editForm.jobTitle}
                  onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Employment Type</label>
                  <select
                    value={editForm.employmentType}
                    onChange={(e) => setEditForm({ ...editForm, employmentType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Probation Status</label>
                  <select
                    value={editForm.probationStatus}
                    onChange={(e) => setEditForm({ ...editForm, probationStatus: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  >
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="IN_PROBATION">In Probation</option>
                    <option value="EXTENDED">Extended</option>
                    <option value="NOT_APPLICABLE">Not Applicable</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Personal Email</label>
                  <input
                    type="email"
                    value={editForm.personalEmail}
                    onChange={(e) => setEditForm({ ...editForm, personalEmail: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white font-semibold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {updating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATUS TRANSITION MODAL */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRightCircle className="w-5 h-5 text-[#293381] dark:text-[#36B4FF]" />
                Transition Employment Status
              </h2>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {statusError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{statusError}</span>
              </div>
            )}

            <form onSubmit={handleStatusSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Status *</label>
                <select
                  value={statusForm.newStatus}
                  onChange={(e) => setStatusForm({ ...statusForm, newStatus: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ON_LEAVE">ON_LEAVE</option>
                  <option value="PROBATION">PROBATION</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="TERMINATED">TERMINATED</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Effective Date *</label>
                <input
                  type="date"
                  required
                  value={statusForm.effectiveDate}
                  onChange={(e) => setStatusForm({ ...statusForm, effectiveDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Transition *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Approved medical leave, completion of probation period..."
                  value={statusForm.reason}
                  onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transitioning}
                  className="px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white font-semibold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {transitioning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Status Transition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: Document Vault */}
      {activeTab === "documents" && (
        <DocumentVault employeeId={employee.id} canUpload={true} canVerify={true} />
      )}

      {/* Tab 4: Sensitive Financials */}
      {activeTab === "financials" && (
        <SensitiveFinancialCard
          employeeId={employee.id}
          canManage={
            user?.roles.includes("SUPER_ADMIN") ||
            user?.roles.includes("ADMIN") ||
            user?.roles.includes("FINANCE_ADMIN") ||
            user?.permissions?.includes("sensitive.salary.manage")
          }
        />
      )}
    </div>
  );
}
