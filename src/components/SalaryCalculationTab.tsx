"use client";

import React, { useState } from "react";
import {
  Calculator,
  Clock,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  TrendingDown,
  CalendarCheck,
  ShieldAlert,
  ArrowRight,
  Info,
  DollarSign,
} from "lucide-react";

interface SalaryCalculationTabProps {
  employeeId: string;
  employeeCode?: string;
  basicSalary?: number;
}

export default function SalaryCalculationTab({
  employeeId,
  employeeCode,
  basicSalary = 50000,
}: SalaryCalculationTabProps) {
  // Simulator State
  const [simPunchIn, setSimPunchIn] = useState("09:30");
  const [simPunchOut, setSimPunchOut] = useState("17:30");
  const [hasOutPunch, setHasOutPunch] = useState(true);
  const [exhaustedShortLeaves, setExhaustedShortLeaves] = useState(false);
  const [simUnauthorizedShift, setSimUnauthorizedShift] = useState(false);
  const [simShiftException, setSimShiftException] = useState(false);
  const [simPenaltyAction, setSimPenaltyAction] = useState<"OFF" | "HALF_DAY">("OFF");
  const [monthlySalary, setMonthlySalary] = useState(basicSalary || 50000);
  const [standardShiftHours, setStandardShiftHours] = useState(9);
  const [workingDaysInMonth, setWorkingDaysInMonth] = useState(22);

  // Compute Daily & Hourly Rates
  const dailyRate = Math.round(monthlySalary / workingDaysInMonth);
  const hourlyRate = Math.round(dailyRate / standardShiftHours);

  // Calculate Duration
  const calculateSimulation = () => {
    // Unauthorized Shift Check
    if (simUnauthorizedShift && !simShiftException) {
      const isHalf = simPenaltyAction === "HALF_DAY";
      return {
        type: isHalf ? "HALF_DAY" : "OFF",
        status: isHalf ? "Unauthorized Shift (Half Day LOP)" : "Unauthorized Shift (Full Day LOP)",
        description: `Employee reported to an unassigned shift without prior supervisor exception. Penalized as ${isHalf ? "Half Day Deduction" : "Full Day Off (Loss of Pay)"}.`,
        deductionHours: isHalf ? standardShiftHours / 2 : standardShiftHours,
        deductionAmount: isHalf ? Math.round(dailyRate * 0.5) : dailyRate,
        netDayPay: isHalf ? Math.round(dailyRate * 0.5) : 0,
        badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
      };
    }

    if (!hasOutPunch || !simPunchOut) {
      return {
        type: "HALF_DAY",
        status: "Entry Missing",
        description: "Either in-time or out-time is missing (single punch recorded). Counted as Half Day.",
        deductionHours: standardShiftHours / 2,
        deductionAmount: Math.round(dailyRate * 0.5),
        netDayPay: Math.round(dailyRate * 0.5),
        badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
      };
    }

    const [inH, inM] = simPunchIn.split(":").map(Number);
    const [outH, outM] = simPunchOut.split(":").map(Number);
    const totalMinutes = outH * 60 + outM - (inH * 60 + inM);

    if (totalMinutes < 0) {
      return {
        type: "INVALID",
        status: "Invalid Time",
        description: "Punch out time is before punch in time.",
        deductionHours: 0,
        deductionAmount: 0,
        netDayPay: 0,
        badgeClass: "bg-slate-100 text-slate-800",
      };
    }

    // Rule: Under 4 hrs 30 mins (270 min) -> Off (Absent / Loss of Pay)
    if (totalMinutes < 270) {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return {
        type: "OFF",
        status: "Off (Full Day Deduction)",
        description: `Worked ${h}h ${m}m (< 4 hrs 30 min threshold). Counted as Off with full day pay deduction.`,
        deductionHours: standardShiftHours,
        deductionAmount: dailyRate,
        netDayPay: 0,
        badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
      };
    }

    // Rule: Completed between 4h 30m and shift completion
    const requiredMinutes = standardShiftHours * 60;
    const isLateIn = inH * 60 + inM > 9 * 60 + 30; // after 9:30 grace
    const isEarlyOut = outH * 60 + outM < 18 * 60;

    if (totalMinutes >= 270 && totalMinutes < requiredMinutes - 60) {
      // Completed 4h 30m but left very early -> Half Day
      return {
        type: "HALF_DAY",
        status: "Half Day Deduction",
        description: `Worked ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m. Completed 4h 30m but left before minimum shift threshold. Counted as Half Day.`,
        deductionHours: standardShiftHours / 2,
        deductionAmount: Math.round(dailyRate * 0.5),
        netDayPay: Math.round(dailyRate * 0.5),
        badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
      };
    }

    // Rule: Late Morning or Early Leave by 1 hr
    if (totalMinutes < requiredMinutes) {
      if (exhaustedShortLeaves) {
        return {
          type: "SHORT_LEAVE_EXHAUSTED",
          status: "1 Hour Pay Deduction",
          description: "Allocated Short Leaves / Late Morning allowances are exhausted. 1 hour of pay is deducted for this day.",
          deductionHours: 1,
          deductionAmount: hourlyRate,
          netDayPay: Math.max(0, dailyRate - hourlyRate),
          badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
        };
      } else {
        return {
          type: "SHORT_LEAVE_COVERED",
          status: "Short Leave Consumed (No Deduction)",
          description: "Covered by employee's allocated Short Leave allowance. No salary deduction applied.",
          deductionHours: 0,
          deductionAmount: 0,
          netDayPay: dailyRate,
          badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
        };
      }
    }

    // Full Present
    return {
      type: "FULL_DAY",
      status: "Full Day Present",
      description: "Completed full shift hours. 100% full day salary payable.",
      deductionHours: 0,
      deductionAmount: 0,
      netDayPay: dailyRate,
      badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    };
  };

  const sim = calculateSimulation();

  return (
    <div className="space-y-6">
      {/* Header Overview Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#293381] dark:text-[#36B4FF]" />
              Salary Calculation & Deduction Policy
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Automated salary calculation formulas, punch log deduction rules, and exhausted allowance penalties.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-medium">
              Daily Rate: ₹{dailyRate.toLocaleString()}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-medium">
              Hourly: ₹{hourlyRate.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 4 Core Rule Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Rule 1: Machine 1 - PV Punch Deduction */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#293381]/10 text-[#293381] dark:text-[#36B4FF]">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                1. Machine 1 - PV Punch Rules
              </h3>
            </div>

            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#293381] dark:bg-[#36B4FF] mt-1.5 shrink-0" />
                <span>
                  <strong>Punch Mapping</strong>: Earliest punch of the day is In-Time. Latest punch of the day is Out-Time.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Missing Punch Deduction</strong>: If either In-Time or Out-Time is missing (single punch), marked as <em>Entry Missing</em> and deducted as <strong>Half Day (0.5× Daily Rate)</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Under 4.5h Work Deduction</strong>: If both punches exist but total duration &lt; <strong>4 hrs 30 min</strong>, counted as <strong>Off (Full Day Pay Deduction)</strong>.
                </span>
              </li>
            </ul>
          </div>

          {/* Rule 2: Late Morning / Short Leave Deduction */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <TrendingDown className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                2. Late Morning Deductions
              </h3>
            </div>

            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Allocated Allowance</strong>: Reporting up to 1 hr late is permitted without deduction while allocated Short Leaves remain.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                <span>
                  <strong>After Exhaustion Penalty</strong>: After allocated Short Leaves are exhausted, <strong>1 hour of pay is deducted</strong> from that day's salary.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Calculation Formula</strong>: <br />
                  <code className="text-[11px] font-mono bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 block mt-1">
                    Deduction = 1 hr × Hourly Rate
                  </code>
                </span>
              </li>
            </ul>
          </div>

          {/* Rule 3: Grace Time & Early Leave Deduction */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                3. Grace Time & Early Leave
              </h3>
            </div>

            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Shift Extension</strong>: Reporting within grace period (e.g. 9:30 AM for a 9:00 AM shift) requires completing shift hours (leave by 6:30 PM).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Early Leave by 1 Hour</strong>: Leaving by 5:30 PM consumes a Short Leave. If exhausted, <strong>1 hour of pay is deducted</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Leaving Before 5:30 PM</strong>: If 4h 30m completed → <strong>Half Day Deduction</strong>. If &lt; 4h 30m → <strong>Off / Full Day LOP</strong>.
                </span>
              </li>
            </ul>
          </div>

          {/* Rule 4: Unauthorized Shift Protection */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                4. Unauthorized Shift Rule
              </h3>
            </div>

            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Allowed Roster</strong>: Employees must punch into their <strong>Default Shift</strong> or either of their <strong>2 Allowed Alternate Shifts</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Unapproved Reporting</strong>: Reporting to an unallocated shift without prior supervisor exception triggers <strong>Full Day Off (LOP)</strong> or <strong>Half Day Deduction</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Exception Waiver</strong>: When a supervisor or HR grants a shift exception, normal pay calculation is restored.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Interactive Salary & Deduction Simulator */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" />
          Interactive Daily Salary Deduction Calculator
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          Simulate a sample day's punch timings to test the automated salary deduction and net daily payout.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="space-y-4 lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Monthly Salary (₹)
                </label>
                <input
                  type="number"
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(Number(e.target.value) || 0)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Working Days in Month
                </label>
                <input
                  type="number"
                  value={workingDaysInMonth}
                  onChange={(e) => setWorkingDaysInMonth(Number(e.target.value) || 1)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Daily Shift Hours
                </label>
                <input
                  type="number"
                  value={standardShiftHours}
                  onChange={(e) => setStandardShiftHours(Number(e.target.value) || 1)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Punch In Time
                </label>
                <input
                  type="time"
                  value={simPunchIn}
                  onChange={(e) => setSimPunchIn(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Punch Out Time
                </label>
                <input
                  type="time"
                  disabled={!hasOutPunch}
                  value={simPunchOut}
                  onChange={(e) => setSimPunchOut(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-40"
                />
              </div>

              <div className="flex flex-col justify-end space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!hasOutPunch}
                    onChange={(e) => setHasOutPunch(!e.target.checked)}
                    className="rounded text-[#293381] focus:ring-[#36B4FF]"
                  />
                  <span>Out-Punch Missing (Entry Missing)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exhaustedShortLeaves}
                    onChange={(e) => setExhaustedShortLeaves(e.target.checked)}
                    className="rounded text-[#293381] focus:ring-[#36B4FF]"
                  />
                  <span>Short Leaves Exhausted (0 left)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simUnauthorizedShift}
                    onChange={(e) => setSimUnauthorizedShift(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Reported to Unapproved Shift</span>
                </label>

                {simUnauthorizedShift && (
                  <div className="pl-5 space-y-1 pt-1">
                    <label className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simShiftException}
                        onChange={(e) => setSimShiftException(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Supervisor Exception Granted</span>
                    </label>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-slate-500">Penalty:</span>
                      <select
                        value={simPenaltyAction}
                        onChange={(e) => setSimPenaltyAction(e.target.value as "OFF" | "HALF_DAY")}
                        className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1 py-0.5 text-[11px]"
                      >
                        <option value="OFF">Full Day LOP (Off)</option>
                        <option value="HALF_DAY">Half Day Deduction</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Result Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Calculated Outcome
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${sim.badgeClass}`}>
                  {sim.status}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {sim.description}
              </p>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Gross Daily Pay:</span>
                <span className="font-mono font-semibold">₹{dailyRate.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
                <span>Deduction ({sim.deductionHours} hrs):</span>
                <span className="font-mono font-bold">-₹{sim.deductionAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Net Payable for Day:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  ₹{sim.netDayPay.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
