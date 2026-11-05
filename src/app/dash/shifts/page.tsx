"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Calendar,
  Coffee,
  ShieldCheck,
  Moon,
  Sun,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  CalendarRange,
} from "lucide-react";
import { useAuth } from "@/components/AuthGate";

const DAYS_OF_WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_FULL_NAMES: Record<string, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

export default function EmployeeShiftsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeShift, setActiveShift] = useState<any>(null);
  const [weekCalendar, setWeekCalendar] = useState<any[]>([]);
  const [allOrgShifts, setAllOrgShifts] = useState<any[]>([]);

  // Fetch current week calendar and shift
  const fetchShiftData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Compute current week's Monday and Sunday
      const now = new Date();
      const day = now.getDay();
      const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diffToMon));
      const sunday = new Date(now.setDate(diffToMon + 6));

      const startStr = monday.toISOString().split("T")[0];
      const endStr = sunday.toISOString().split("T")[0];

      // 1. Fetch weekly calendar
      const calRes = await fetch(`/payrol/api/shifts/assignments?startDate=${startStr}&endDate=${endStr}`);
      const calData = await calRes.json();
      if (calRes.ok && calData.calendar) {
        setWeekCalendar(calData.calendar);
      }

      // 2. Fetch today's status to get active shift
      const statusRes = await fetch("/payrol/api/attendance/status");
      const statusData = await statusRes.json();
      if (statusRes.ok && statusData.status?.shift) {
        setActiveShift(statusData.status.shift);
      }

      // 3. Fetch org shifts for policy visibility
      const shiftsRes = await fetch("/payrol/api/shifts");
      const shiftsData = await shiftsRes.json();
      if (shiftsRes.ok && shiftsData.shifts) {
        setAllOrgShifts(shiftsData.shifts);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load shift information");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShiftData();
  }, [fetchShiftData]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#293381] tracking-tight flex items-center gap-2">
          <Clock className="w-6 h-6 text-[#36B4FF]" />
          My Shift Schedule
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Assigned working hours, weekly rotation patterns, break intervals, and company shift catalog.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center bg-white border border-slate-200 rounded-2xl">
          <Loader2 className="w-6 h-6 animate-spin text-[#293381] mx-auto" />
          <p className="text-xs text-slate-400 mt-2">Loading shift schedule...</p>
        </div>
      ) : (
        <>
          {/* Active Shift Hero Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-44 h-44 bg-[#36B4FF]/10 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[11px] font-bold text-[#36B4FF] uppercase tracking-wider">
                  Primary Shift Assignment
                </span>
                <h2 className="text-xl font-bold text-[#293381] mt-0.5">
                  {activeShift?.name || "General Day Shift"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {activeShift?.isOvernight ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5" /> Overnight Shift
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5" /> Day Shift
                  </span>
                )}
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] text-slate-400 font-semibold uppercase">Working Hours</p>
                <p className="text-lg font-bold font-mono text-[#293381] mt-1">
                  {activeShift?.startTime || "09:00"} - {activeShift?.endTime || "18:00"}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">IST (UTC+05:30)</p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] text-slate-400 font-semibold uppercase">Grace Period</p>
                <p className="text-lg font-bold text-[#293381] mt-1">
                  {activeShift?.graceMinutes ?? 15} mins
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Allowed late window</p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] text-slate-400 font-semibold uppercase">Break Allowance</p>
                <p className="text-lg font-bold text-[#293381] mt-1">
                  {activeShift?.breakMinutes ?? 60} mins
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Deducted from gross duration</p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] text-slate-400 font-semibold uppercase">Min Half-Day</p>
                <p className="text-lg font-bold text-[#293381] mt-1">
                  {activeShift?.halfDayThresholdMinutes
                    ? `${(activeShift.halfDayThresholdMinutes / 60).toFixed(1)} hrs`
                    : "4.0 hrs"}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Threshold for half-day credit</p>
              </div>
            </div>
          </div>

          {/* Weekly Roster Pattern */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#293381] flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-[#36B4FF]" />
                  Weekly Roster (Current Week)
                </h3>
                <p className="text-xs text-slate-500">
                  Scheduled daily shifts and designated rest days for this week.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
              {weekCalendar.map((item, idx) => {
                const dateObj = new Date(item.date);
                const dayName = dateObj.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
                const isToday = item.date === new Date().toISOString().split("T")[0];

                return (
                  <div
                    key={idx}
                    className={`rounded-xl border p-4 text-center transition flex flex-col justify-between ${
                      isToday
                        ? "border-[#36B4FF] bg-[#36B4FF]/5 shadow-sm ring-2 ring-[#36B4FF]/30"
                        : item.isWorkingDay
                        ? "border-slate-200 bg-white"
                        : "border-slate-100 bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">
                          {dayName}
                        </span>
                        {isToday && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#36B4FF] text-[#293381] font-bold">
                            TODAY
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-700 mt-1">{item.date}</p>
                    </div>

                    <div className="my-3">
                      {item.isWorkingDay ? (
                        <div>
                          <p className="text-xs font-bold text-[#293381]">{item.shiftName}</p>
                          <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                            {item.startTime} - {item.endTime}
                          </p>
                        </div>
                      ) : (
                        <div className="py-2">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-200/70 text-slate-600">
                            WEEKEND / REST
                          </span>
                        </div>
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-semibold ${
                        item.isWorkingDay ? "text-emerald-600" : "text-slate-400"
                      }`}
                    >
                      {item.isWorkingDay ? "Working Day" : "Off Duty"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Company Shift Reference Guide */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#293381]">Company Shift Catalog</h3>
              <p className="text-xs text-slate-500">Standard organizational shift definitions and timings.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allOrgShifts.map((sh) => (
                <div
                  key={sh.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-[#293381]">{sh.name}</h4>
                    <span className="font-mono text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-semibold">
                      {sh.code}
                    </span>
                  </div>
                  <p className="text-xs font-mono font-medium text-slate-800">
                    {sh.startTime} - {sh.endTime}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                    <span>Break: {sh.breakMinutes}m</span>
                    <span>•</span>
                    <span>Grace: {sh.graceMinutes}m</span>
                    <span>•</span>
                    <span>{sh.isOvernight ? "Night" : "Day"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
