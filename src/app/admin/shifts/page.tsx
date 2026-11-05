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
} from "lucide-react";
import { useAuth } from "@/components/AuthGate";

export default function AdminShiftsPage() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

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

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
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

              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-[#293381] dark:text-white text-base">{s.name}</h3>
                  <span className="font-mono text-xs text-[#36B4FF] font-bold">{s.code}</span>
                </div>
                {s.isOvernight ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                    <Moon className="w-3 h-3 text-purple-600" /> Overnight
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <Sun className="w-3 h-3 text-amber-600" /> Day Shift
                  </span>
                )}
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

              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>Status: Active</span>
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
    </div>
  );
}
