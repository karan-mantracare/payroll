"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Plus,
  UserCheck,
  Calendar,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sun,
  Moon,
  CheckCircle2,
  Users,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/components/AuthGate";

export default function AdminShiftsPage() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Create Shift Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    code: "",
    startTime: "09:00",
    endTime: "18:00",
    breakDurationMinutes: 60,
    isOvernight: false,
    colorCode: "#36B4FF",
  });

  // Edit Shift Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    id: "",
    name: "",
    code: "",
    startTime: "09:00",
    endTime: "18:00",
    breakDurationMinutes: 60,
    isOvernight: false,
    colorCode: "#36B4FF",
  });

  // Assign Shift Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({
    employeeId: "",
    shiftId: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    patternDays: ["MON", "TUE", "WED", "THU", "FRI"],
    reason: "",
  });

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/payrol/api/shifts");
      if (!res.ok) throw new Error("Failed to load shifts");
      const data = await res.json();
      setShifts(data.shifts || []);
      if (data.shifts && data.shifts.length > 0 && !assignForm.shiftId) {
        setAssignForm((prev) => ({ ...prev, shiftId: data.shifts[0].id }));
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, [assignForm.shiftId]);

  const fetchChangeRequests = useCallback(async () => {
    try {
      const res = await fetch("/payrol/api/shifts/change-requests");
      if (res.ok) {
        const data = await res.json();
        setChangeRequests(data.requests || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchShifts();
    fetchChangeRequests();
  }, [fetchShifts, fetchChangeRequests]);

  const handleReviewChangeRequest = async (id: string, status: "APPROVED" | "REJECTED") => {
    let rejectionReason: string | undefined;
    if (status === "REJECTED") {
      const input = prompt("Enter reason for declining this schedule change request:");
      if (!input) return;
      rejectionReason = input;
    }
    try {
      setReviewingId(id);
      const res = await fetch(`/payrol/api/shifts/change-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectionReason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Review failed");
      }
      await fetchChangeRequests();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setReviewingId(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/payrol/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create shift");

      setShowCreateModal(false);
      setCreateForm({
        name: "",
        code: "",
        startTime: "09:00",
        endTime: "18:00",
        breakDurationMinutes: 60,
        isOvernight: false,
        colorCode: "#36B4FF",
      });
      await fetchShifts();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEditModal = (shift: any) => {
    setEditForm({
      id: shift.id,
      name: shift.name,
      code: shift.code,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakDurationMinutes: shift.breakDurationMinutes ?? 60,
      isOvernight: Boolean(shift.isOvernight),
      colorCode: shift.colorCode || "#36B4FF",
    });
    setEditError(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditing(true);
    setEditError(null);

    try {
      const res = await fetch("/payrol/api/shifts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update shift");

      setShowEditModal(false);
      await fetchShifts();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditing(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigning(true);
    setAssignError(null);

    try {
      const res = await fetch("/payrol/api/shifts/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIdOrCode: assignForm.employeeId,
          shiftId: assignForm.shiftId,
          startDate: assignForm.startDate,
          endDate: assignForm.endDate || undefined,
          patternDays: assignForm.patternDays,
          reason: assignForm.reason || "Shift assigned by HR",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign shift");

      setShowAssignModal(false);
      setAssignForm({
        employeeId: "",
        shiftId: shifts[0]?.id || "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: "",
        patternDays: ["MON", "TUE", "WED", "THU", "FRI"],
        reason: "",
      });
      alert("Shift assigned successfully!");
    } catch (err: any) {
      setAssignError(err.message);
    } finally {
      setAssigning(false);
    }
  };

  const toggleDay = (day: string) => {
    setAssignForm((prev) => {
      const exists = prev.patternDays.includes(day);
      return {
        ...prev,
        patternDays: exists
          ? prev.patternDays.filter((d) => d !== day)
          : [...prev.patternDays, day],
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#36B4FF]" />
            Shift Roster & Schedule Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure standard, rotational, and overnight shift rules, grace periods, and weekly employee schedules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => {
              fetchChangeRequests();
              setShowRequestsModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-semibold text-xs transition shadow-sm relative"
          >
            <RefreshCw className="w-4 h-4 text-amber-500" />
            Schedule Change Requests
            {changeRequests.filter((r) => r.status === "PENDING").length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                {changeRequests.filter((r) => r.status === "PENDING").length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowAssignModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-semibold text-xs transition shadow-sm"
          >
            <UserCheck className="w-4 h-4 text-[#36B4FF]" />
            Assign Employee to Shift
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white font-semibold text-xs transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create New Shift
          </button>
        </div>
      </div>

      {/* Shifts Grid */}
      {loading ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin text-[#293381] mx-auto" />
          <p className="text-xs text-slate-400 mt-2">Loading shift definitions...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {shifts.map((s) => (
            <div
              key={s.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: s.colorCode || "#36B4FF" }}
              />

              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-[#293381] dark:text-white text-base">{s.name}</h3>
                  <span className="font-mono text-xs text-[#36B4FF] font-bold">{s.code}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {s.isOvernight ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                      <Moon className="w-3 h-3 text-purple-600" /> Overnight
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <Sun className="w-3 h-3 text-amber-600" /> Day Shift
                    </span>
                  )}
                  <button
                    onClick={() => handleOpenEditModal(s)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#293381] dark:hover:text-[#36B4FF] hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Edit Shift"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Timings:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {s.startTime} - {s.endTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Break Duration:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {s.breakDurationMinutes} mins
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Grace Period:</span>
                  <span className="font-mono text-emerald-600 font-semibold">15 mins</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleOpenEditModal(s)}
                    className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 font-semibold hover:text-[#293381] dark:hover:text-[#36B4FF] transition"
                  >
                    <Pencil className="w-3 h-3 text-[#36B4FF]" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setAssignForm((prev) => ({ ...prev, shiftId: s.id }));
                      setShowAssignModal(true);
                    }}
                    className="text-[#293381] dark:text-[#36B4FF] font-semibold hover:underline"
                  >
                    Assign to Employee →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Shift Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#293381] dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#36B4FF]" />
              Create Shift Definition
            </h3>

            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Shift Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Afternoon Support"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Shift Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AFTERNOON"
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Time (24h) *
                  </label>
                  <input
                    type="time"
                    required
                    value={createForm.startTime}
                    onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    End Time (24h) *
                  </label>
                  <input
                    type="time"
                    required
                    value={createForm.endTime}
                    onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="overnight"
                  checked={createForm.isOvernight}
                  onChange={(e) => setCreateForm({ ...createForm, isOvernight: e.target.checked })}
                  className="rounded text-[#293381]"
                />
                <label htmlFor="overnight" className="font-semibold text-slate-700 dark:text-slate-300">
                  Overnight Shift (Crosses Midnight)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Shift Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#293381] dark:text-white flex items-center gap-2">
              <Pencil className="w-5 h-5 text-[#36B4FF]" />
              Edit Shift Definition
            </h3>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Shift Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Afternoon Support"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Shift Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AFTERNOON"
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Time (24h) *
                  </label>
                  <input
                    type="time"
                    required
                    value={editForm.startTime}
                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    End Time (24h) *
                  </label>
                  <input
                    type="time"
                    required
                    value={editForm.endTime}
                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Break Duration (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="240"
                  value={editForm.breakDurationMinutes}
                  onChange={(e) => setEditForm({ ...editForm, breakDurationMinutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editOvernight"
                  checked={editForm.isOvernight}
                  onChange={(e) => setEditForm({ ...editForm, isOvernight: e.target.checked })}
                  className="rounded text-[#293381]"
                />
                <label htmlFor="editOvernight" className="font-semibold text-slate-700 dark:text-slate-300">
                  Overnight Shift (Crosses Midnight)
                </label>
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
                  disabled={editing}
                  className="px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                >
                  {editing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Employee to Shift Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#293381] dark:text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#36B4FF]" />
              Assign Employee to Shift Schedule
            </h3>

            {assignError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {assignError}
              </div>
            )}

            <form onSubmit={handleAssignSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Employee ID or Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EMP-006"
                  value={assignForm.employeeId}
                  onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Shift *
                </label>
                <select
                  required
                  value={assignForm.shiftId}
                  onChange={(e) => setAssignForm({ ...assignForm, shiftId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}: {s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Effective From *
                  </label>
                  <input
                    type="date"
                    required
                    value={assignForm.startDate}
                    onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Effective Until (Optional)
                  </label>
                  <input
                    type="date"
                    value={assignForm.endDate}
                    onChange={(e) => setAssignForm({ ...assignForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Weekly Working Pattern Days
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
                    <button
                      type="button"
                      key={d}
                      onClick={() => toggleDay(d)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition ${
                        assignForm.patternDays.includes(d)
                          ? "bg-[#293381] text-white border-[#293381]"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Assignment
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rotational shift schedule Q3"
                  value={assignForm.reason}
                  onChange={(e) => setAssignForm({ ...assignForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                >
                  {assigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Change Requests Modal */}
      {showRequestsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-[#293381] dark:text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#36B4FF]" />
                Employee Schedule Change Requests
              </h3>
              <button
                onClick={() => setShowRequestsModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {changeRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No schedule change requests found.
                </div>
              ) : (
                changeRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white mr-2">
                          {req.employeeName}
                        </span>
                        <span className="font-mono text-[#36B4FF]">({req.employeeCode})</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        Effective: {req.effectiveDate}
                        {req.endDate ? ` → ${req.endDate}` : ""}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[#293381] dark:text-white">
                        {req.currentShiftName} → {req.requestedShiftName} ({req.requestedShiftTimings})
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Days: {(req.patternDays || []).join(", ")}
                      </span>
                    </div>

                    <div className="text-slate-600 dark:text-slate-400 italic">
                      Reason: &quot;{req.reason}&quot;
                    </div>

                    {req.status === "PENDING" ? (
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => handleReviewChangeRequest(req.id, "REJECTED")}
                          disabled={reviewingId === req.id}
                          className="px-3 py-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold transition"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleReviewChangeRequest(req.id, "APPROVED")}
                          disabled={reviewingId === req.id}
                          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-sm"
                        >
                          Approve & Apply Schedule
                        </button>
                      </div>
                    ) : (
                      <div className="text-right">
                        <span
                          className={`font-bold text-[11px] uppercase ${
                            req.status === "APPROVED" ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
