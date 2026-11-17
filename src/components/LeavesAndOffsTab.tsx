"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CalendarDays,
  Clock,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  CalendarCheck,
  ShieldAlert,
  RotateCcw,
} from "lucide-react";

export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

const ALL_DAYS: { key: DayOfWeek; label: string }[] = [
  { key: "Mon", label: "Monday" },
  { key: "Tue", label: "Tuesday" },
  { key: "Wed", label: "Wednesday" },
  { key: "Thu", label: "Thursday" },
  { key: "Fri", label: "Friday" },
  { key: "Sat", label: "Saturday" },
  { key: "Sun", label: "Sunday" },
];

interface LeavesAndOffsProps {
  employeeId: string;
  employeeCode?: string;
  canManage?: boolean;
}

export default function LeavesAndOffsTab({
  employeeId,
  employeeCode,
  canManage = true,
}: LeavesAndOffsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Policy Form State
  const [workingDays, setWorkingDays] = useState<5 | 6 | 7>(5);
  const [weekOffCount, setWeekOffCount] = useState<1 | 2 | 3>(2);
  const [weekOffDays, setWeekOffDays] = useState<DayOfWeek[]>(["Sat", "Sun"]);
  const [weekOffException, setWeekOffException] = useState<"None" | DayOfWeek>("None");
  const [shortLeaveAllowed, setShortLeaveAllowed] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [graceTimeMinutes, setGraceTimeMinutes] = useState<number>(30);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const fetchPolicy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/payroll/api/employees/${employeeId}/leaves-offs`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to load leaves and offs settings");
      }
      const json = await res.json();
      if (json.data) {
        setWorkingDays(json.data.workingDaysPerWeek || 5);
        const count = json.data.weekOffCount || 2;
        setWeekOffCount(count);
        const days = Array.isArray(json.data.weekOffDays) && json.data.weekOffDays.length > 0
          ? json.data.weekOffDays.slice(0, count)
          : ["Sat", "Sun"].slice(0, count);
        setWeekOffDays(days);
        setWeekOffException(json.data.weekOffException || "None");
        setShortLeaveAllowed(json.data.shortLeaveAllowed || 2);
        setGraceTimeMinutes(
          typeof json.data.graceTimeMinutes === "number" ? json.data.graceTimeMinutes : 30
        );
        if (json.data.updatedAt) {
          setLastUpdatedAt(json.data.updatedAt);
        }
      }
    } catch (err: any) {
      setError(err.message || "Could not retrieve employee settings.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  // Handle Week Off Count Change
  const handleWeekOffCountChange = (newCount: 1 | 2 | 3) => {
    setWeekOffCount(newCount);
    if (weekOffDays.length > newCount) {
      setWeekOffDays(weekOffDays.slice(0, newCount));
    } else if (weekOffDays.length < newCount) {
      // Find unused days to auto-fill or suggest
      const unused = ALL_DAYS.map((d) => d.key).filter((d) => !weekOffDays.includes(d));
      const needed = newCount - weekOffDays.length;
      const additions = unused.slice(0, needed);
      setWeekOffDays([...weekOffDays, ...additions]);
    }
  };

  // Add Week Off Day
  const handleAddWeekOffDay = () => {
    if (weekOffDays.length >= weekOffCount) return;
    const unused = ALL_DAYS.map((d) => d.key).find((d) => !weekOffDays.includes(d));
    if (unused) {
      setWeekOffDays([...weekOffDays, unused]);
    } else {
      setWeekOffDays([...weekOffDays, "Sun"]);
    }
  };

  // Update specific day in array
  const handleUpdateDay = (index: number, newDay: DayOfWeek) => {
    const updated = [...weekOffDays];
    updated[index] = newDay;
    setWeekOffDays(updated);
  };

  // Remove specific day from array
  const handleRemoveDay = (index: number) => {
    if (weekOffDays.length <= 1) return;
    const updated = weekOffDays.filter((_, i) => i !== index);
    setWeekOffDays(updated);
  };

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        workingDaysPerWeek: workingDays,
        weekOffCount,
        weekOffDays,
        weekOffException,
        shortLeaveAllowed,
        graceTimeMinutes,
      };

      const res = await fetch(`/payroll/api/employees/${employeeId}/leaves-offs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save settings");
      }

      setSuccessMessage("Leaves & Offs policy settings saved successfully.");
      if (json.data?.updatedAt) {
        setLastUpdatedAt(json.data.updatedAt);
      }
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center text-slate-500 shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-[#293381] dark:text-[#36B4FF] mb-3" />
        <p className="text-sm">Loading employee leaves and offs policy...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-semibold ml-4">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Settings Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#293381] dark:text-[#36B4FF]" />
              Leaves & Offs Policy Configuration
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Configure weekly schedules, rest days, short leaves, and grace period thresholds for this employee.
            </p>
          </div>

          {lastUpdatedAt && (
            <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 self-start sm:self-auto">
              <Clock className="w-3.5 h-3.5" />
              <span>Last updated: {new Date(lastUpdatedAt).toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Working Days in a Week */}
          <div className="space-y-2 p-4 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <CalendarCheck className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" />
              Working Days in a Week
            </label>
            <p className="text-[11px] text-slate-500">
              Select standard number of working days scheduled per week.
            </p>
            <div className="flex items-center gap-2 pt-2">
              {([5, 6, 7] as const).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setWorkingDays(days)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition border ${
                    workingDays === days
                      ? "bg-[#293381] text-white border-[#293381] shadow-sm dark:bg-[#36B4FF] dark:text-slate-950 dark:border-[#36B4FF]"
                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>
          </div>

          {/* 2. Week Off Count Allowed */}
          <div className="space-y-2 p-4 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" />
              Week Off Count Allowed
            </label>
            <p className="text-[11px] text-slate-500">
              Total number of designated weekly off days allocated.
            </p>
            <div className="flex items-center gap-2 pt-2">
              {([1, 2, 3] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => handleWeekOffCountChange(count)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition border ${
                    weekOffCount === count
                      ? "bg-[#293381] text-white border-[#293381] shadow-sm dark:bg-[#36B4FF] dark:text-slate-950 dark:border-[#36B4FF]"
                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {count} {count === 1 ? "Day" : "Days"} Off
                </button>
              ))}
            </div>
          </div>

          {/* 3. Week Off Days (Dynamic with + sign) */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 md:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" />
                  Designated Week Off Day(s)
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Specify which day(s) of the week are designated as rest days. Max allowed: {weekOffCount}.
                </p>
              </div>

              {weekOffCount > 1 && weekOffDays.length < weekOffCount && (
                <button
                  type="button"
                  onClick={handleAddWeekOffDay}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-medium shadow-sm transition dark:bg-[#36B4FF] dark:text-slate-950 dark:hover:bg-[#209ee8]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Week Off Day</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
              {weekOffDays.map((day, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs"
                >
                  <span className="text-xs font-semibold text-slate-400 w-12 shrink-0">
                    Day #{idx + 1}
                  </span>
                  <select
                    value={day}
                    onChange={(e) => handleUpdateDay(idx, e.target.value as DayOfWeek)}
                    className="flex-1 bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    {ALL_DAYS.map((d) => (
                      <option key={d.key} value={d.key} className="dark:bg-slate-900">
                        {d.label} ({d.key})
                      </option>
                    ))}
                  </select>
                  {weekOffDays.length > 1 && (
                    <button
                      type="button"
                      title="Remove Day"
                      onClick={() => handleRemoveDay(idx)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 4. Week Off Day Exception */}
          <div className="space-y-2 p-4 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" />
              Week Off Day Exception
            </label>
            <p className="text-[11px] text-slate-500">
              Specify an exception day where standard week off rules do not apply (e.g. alternate working days).
            </p>
            <div className="pt-2">
              <select
                value={weekOffException}
                onChange={(e) => setWeekOffException(e.target.value as "None" | DayOfWeek)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#293381]"
              >
                <option value="None">None (No Exception Day)</option>
                {ALL_DAYS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label} ({d.key})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 5. Late Morning / Short Leave Allowed */}
          <div className="space-y-2 p-4 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" />
              Late Morning / Short Leave Allowed
            </label>
            <p className="text-[11px] text-slate-500">
              Monthly allocation of 1-hour late morning allowances.
            </p>
            <div className="flex items-center gap-1.5 pt-2">
              {([1, 2, 3, 4, 5] as const).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setShortLeaveAllowed(num)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition border ${
                    shortLeaveAllowed === num
                      ? "bg-[#293381] text-white border-[#293381] shadow-sm dark:bg-[#36B4FF] dark:text-slate-950 dark:border-[#36B4FF]"
                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Short Leave FYI Policy Card */}
          <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
              <span className="font-semibold block mb-0.5 text-blue-950 dark:text-blue-100">
                Short Leave Policy Note
              </span>
              Allows the employee to report late by 1 hr, without any deduction in pay. After these are exhausted, 1 hr of pay for that day will be deducted.
            </div>
          </div>

          {/* 7. Grace Time Allowed */}
          <div className="space-y-2 p-4 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" />
              Grace Time Allowed
            </label>
            <p className="text-[11px] text-slate-500">
              Grace window for punch-in before late arrival penalty triggers.
            </p>
            <div className="grid grid-cols-5 gap-1.5 pt-2">
              {[0, 15, 30, 45, 60].map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setGraceTimeMinutes(min)}
                  className={`py-2 rounded-lg text-xs font-semibold transition border ${
                    graceTimeMinutes === min
                      ? "bg-[#293381] text-white border-[#293381] shadow-sm dark:bg-[#36B4FF] dark:text-slate-950 dark:border-[#36B4FF]"
                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {min === 0 ? "None" : `${min}m`}
                </button>
              ))}
            </div>
          </div>

          {/* 8. Grace Time FYI Policy Card */}
          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3 md:col-span-2">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <span className="font-semibold block mb-0.5 text-amber-950 dark:text-amber-100">
                Grace Period & Work Duration Rule
              </span>
              If report time is 9:00 AM and grace period is 30 min, employee can report by 9:30 AM, but must leave by 6:30 PM. Leaving early may result in a Short Leave (if leaving by 5:30 PM) or Half Day (if reporting by 9:30 AM, completing 4 hrs 30 min, and leaving before 5:30 PM).
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {canManage && (
          <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={fetchPolicy}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 dark:bg-[#36B4FF] dark:text-slate-950 dark:hover:bg-[#209ee8]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving Changes...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> Save Policy Settings
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
