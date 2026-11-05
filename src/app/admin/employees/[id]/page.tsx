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
} from "lucide-react";
import { useAuth } from "@/components/AuthGate";

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

  useEffect(() => {
    fetchEmployee();
  }, [id]);

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

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");

      setShowEditModal(false);
      fetchEmployee();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Status transition failed");

      setShowStatusModal(false);
      fetchEmployee();
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
      case "PROBATION":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "ON_LEAVE":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "SUSPENDED":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "TERMINATED":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-slate-700 text-slate-300 border-slate-600";
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="text-sm">Loading employee profile...</span>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="space-y-4 max-w-xl mx-auto p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Unable to Load Employee</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error || "Employee record not found"}</p>
        <Link
          href="/admin/employees"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Employee Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Navigation */}
      <div>
        <Link
          href="/admin/employees"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Directory
        </Link>
      </div>

      {/* Hero Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-bold font-mono shrink-0">
              {employee.name.charAt(0)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{employee.name}</h1>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
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
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
            >
              <Edit className="w-3.5 h-3.5" /> Edit Profile
            </button>
            <button
              onClick={() => setShowStatusModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-sm"
            >
              <ArrowRightCircle className="w-3.5 h-3.5" /> Change Status
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Details & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Core & Employment Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Employment Details Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-500" /> Employment Master Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block mb-0.5">Immutable Employee ID</span>
                <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
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
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {employee.employmentType}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block mb-0.5">Probation Status</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {employee.probationStatus}
                </span>
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

          {/* Personal & Emergency Contact Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-500" /> Personal & Emergency Contacts
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Phone Number</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {employee.phone || "Not specified"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Personal Email</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {employee.personalEmail || "Not specified"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Date of Birth</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {employee.dateOfBirth || "Not specified"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Gender</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {employee.gender || "Not specified"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Emergency Contact Person</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {employee.emergencyContactName || "Not specified"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Emergency Contact Phone</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {employee.emergencyContactPhone || "Not specified"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Reporting Manager & Status Audit History */}
        <div className="space-y-6">
          {/* Reporting Line Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-500" /> Reporting Line
            </h2>

            {employee.manager ? (
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Direct Manager
                </span>
                <div className="font-bold text-slate-900 dark:text-white text-sm">
                  {employee.manager.name}
                </div>
                <div className="text-xs text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                  {employee.manager.employeeCode}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {employee.manager.jobTitle}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-400">
                Top of hierarchy (No reporting manager assigned)
              </div>
            )}
          </div>

          {/* Employment Status Transitions History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-500" /> Status Audit Trail
            </h2>

            {employee.statusHistory && employee.statusHistory.length > 0 ? (
              <div className="relative pl-4 space-y-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800 text-xs">
                {employee.statusHistory.map((sh: any) => (
                  <div key={sh.id} className="relative">
                    <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-slate-900" />
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {sh.previousStatus} → <span className="text-indigo-600 dark:text-indigo-400">{sh.newStatus}</span>
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5 italic">
                      "{sh.reason}"
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Effective: {sh.effectiveDate} • Recorded {new Date(sh.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-400">
                Initial employment status: {employee.status} (No transitions recorded)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit className="w-4 h-4 text-indigo-500" /> Edit Employee Profile
              </h2>
              <button onClick={() => setShowEditModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 rounded-lg bg-rose-500/10 text-rose-500 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {editError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Designation / Title</label>
                  <input
                    type="text"
                    required
                    value={editForm.jobTitle}
                    onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Employment Type</label>
                  <select
                    value={editForm.employmentType}
                    onChange={(e) => setEditForm({ ...editForm, employmentType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Probation Status</label>
                  <select
                    value={editForm.probationStatus}
                    onChange={(e) => setEditForm({ ...editForm, probationStatus: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                  >
                    <option value="IN_PROBATION">In Probation</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="EXTENDED">Extended</option>
                    <option value="WAIVED">Waived</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Personal Email</label>
                  <input
                    type="email"
                    value={editForm.personalEmail}
                    onChange={(e) => setEditForm({ ...editForm, personalEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {updating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{updating ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRightCircle className="w-4 h-4 text-indigo-500" /> Transition Employment Status
              </h2>
              <button onClick={() => setShowStatusModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="p-5 space-y-4 text-xs">
              {statusError && (
                <div className="p-3 rounded-lg bg-rose-500/10 text-rose-500 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {statusError}
                </div>
              )}

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 block mb-0.5">Current Status</span>
                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{employee.status}</span>
              </div>

              <div>
                <label className="block font-semibold mb-1">New Target Status *</label>
                <select
                  required
                  value={statusForm.newStatus}
                  onChange={(e) => setStatusForm({ ...statusForm, newStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ON_LEAVE">ON_LEAVE</option>
                  <option value="PROBATION">PROBATION</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="TERMINATED">TERMINATED</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Effective Date *</label>
                <input
                  type="date"
                  required
                  value={statusForm.effectiveDate}
                  onChange={(e) => setStatusForm({ ...statusForm, effectiveDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Reason for Status Change *</label>
                <textarea
                  required
                  rows={3}
                  value={statusForm.reason}
                  onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
                  placeholder="e.g. Approved medical sabbatical for 3 months"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transitioning}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {transitioning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{transitioning ? "Updating..." : "Confirm Transition"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

