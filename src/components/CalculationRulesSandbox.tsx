"use client";

import React, { useState, useEffect } from "react";
import {
  Calculator,
  Clock,
  TrendingDown,
  ShieldAlert,
  ArrowRight,
  Info,
  DollarSign,
  User,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  Scale,
} from "lucide-react";

interface EmployeeOption {
  id: string;
  code: string;
  name: string;
}

export default function CalculationRulesSandbox() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("CUSTOM");

  // Simulator State
  const [monthlySalary, setMonthlySalary] = useState<number>(50000);
  const [workingDaysInMonth, setWorkingDaysInMonth] = useState<number>(22);
  const [standardShiftHours, setStandardShiftHours] = useState<number>(9);

  const [simPunchIn, setSimPunchIn] = useState<string>("09:30");
  const [simPunchOut, setSimPunchOut] = useState<string>("17:30");
  const [hasOutPunch, setHasOutPunch] = useState<boolean>(true);
  const [exhaustedShortLeaves, setExhaustedShortLeaves] = useState<boolean>(false);
  const [simUnauthorizedShift, setSimUnauthorizedShift] = useState<boolean>(false);
  const [simShiftException, setSimShiftException] = useState<boolean>(false);
  const [simPenaltyAction, setSimPenaltyAction] = useState<"OFF" | "HALF_DAY">("HALF_DAY");
  const [simOffDaysInMonth, setSimOffDaysInMonth] = useState<number>(6);

  // Proportionate Deduction Simulator States (Defaults to user's October case: 31d, 6 fixed offs, 19 worked)
  const [propTotalDaysInMonth, setPropTotalDaysInMonth] = useState<number>(31);
  const [propFixedOffs, setPropFixedOffs] = useState<number>(6);
  const [propWorkedDays, setPropWorkedDays] = useState<number>(19);

  // Load employees list for optional selection
  useEffect(() => {
    async function fetchEmployees() {
      try {
        const res = await fetch("/payroll/api/employees");
        if (res.ok) {
          const json = await res.json();
          const list = (json.employees || []).map((e: any) => ({
            id: e.id,
            code: e.employeeCode || e.code,
            name: e.user?.name || e.fullName || e.employeeCode,
          }));
          setEmployees(list);
        }
      } catch {
        // Fallback silently
      }
    }
    fetchEmployees();
  }, []);

  // When an employee is selected, fetch their sensitive salary & shift policies
  const handleSelectEmployee = async (empId: string) => {
    setSelectedEmpId(empId);
    if (empId === "CUSTOM") {
      setMonthlySalary(50000);
      setWorkingDaysInMonth(22);
      setStandardShiftHours(9);
      return;
    }

    try {
      // 1. Fetch Salary
      const resSal = await fetch(`/payroll/api/employees/${empId}/sensitive`);
      if (resSal.ok) {
        const salJson = await resSal.json();
        if (salJson.details?.basicSalary && typeof salJson.details.basicSalary === "number") {
          setMonthlySalary(salJson.details.basicSalary);
        }
      }

      // 2. Fetch Leaves & Offs policy
      const resPolicy = await fetch(`/payroll/api/employees/${empId}/leaves-offs`);
      if (resPolicy.ok) {
        const polJson = await resPolicy.json();
        if (polJson.data) {
          const daysPerWeek = polJson.data.workingDaysPerWeek || 6;
          setWorkingDaysInMonth(daysPerWeek === 6 ? 26 : 22);
        }
      }
    } catch {
      // Maintain defaults
    }
  };

  // Compute Daily & Hourly Rates
  const dailyRate = Math.round(monthlySalary / (workingDaysInMonth || 1));
  const hourlyRate = Math.round(dailyRate / (standardShiftHours || 1));

  // Calculate Simulation Outcome
  const calculateSimulation = () => {
    // 1. Unauthorized Shift Check
    if (simUnauthorizedShift && !simShiftException) {
      const isHalf = simPenaltyAction === "HALF_DAY";
      return {
        type: isHalf ? "HALF_DAY" : "OFF",
        status: isHalf ? "Unauthorized Shift (Half Day LOP)" : "Unauthorized Shift (Full Day LOP)",
        description: `Employee reported to an unassigned shift without supervisor exception. Penalized as ${
          isHalf ? "Half Day Deduction" : "Full Day Off (Loss of Pay)"
        }.`,
        deductionHours: isHalf ? standardShiftHours / 2 : standardShiftHours,
        deductionAmount: isHalf ? Math.round(dailyRate * 0.5) : dailyRate,
        netDayPay: isHalf ? Math.round(dailyRate * 0.5) : 0,
        badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
      };
    }

    // 2. Missing In/Out punch
    if (!hasOutPunch || !simPunchOut) {
      return {
        type: "HALF_DAY",
        status: "Entry Missing",
        description:
          "Either in-time or out-time is missing (single punch recorded). Marked as Entry Missing and counted as Half Day.",
        deductionHours: standardShiftHours / 2,
        deductionAmount: Math.round(dailyRate * 0.5),
        netDayPay: Math.round(dailyRate * 0.5),
        badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
      };
    }

    // Calculate duration in minutes
    const [inH, inM] = simPunchIn.split(":").map(Number);
    const [outH, outM] = simPunchOut.split(":").map(Number);
    const totalMinutes = outH * 60 + outM - (inH * 60 + inM);
    const durationHours = Math.floor(totalMinutes / 60);
    const durationMins = totalMinutes % 60;
    const durationStr = `${durationHours}h ${durationMins}m`;

    // 3. Duration < 4h 30m (270 min) -> Full Day LOP
    if (totalMinutes < 270) {
      return {
        type: "OFF",
        status: "Duration < 4.5h (Counted as Off)",
        description: `Total duration of ${durationStr} is below 4 hrs 30 mins threshold. Marked as Off with Full Day Loss of Pay.`,
        deductionHours: standardShiftHours,
        deductionAmount: dailyRate,
        netDayPay: 0,
        badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
      };
    }

    // 4. Duration between 4h 30m and 8h (Half Day)
    if (totalMinutes < 480) {
      return {
        type: "HALF_DAY",
        status: "Half Day (Incomplete Shift)",
        description: `Completed ${durationStr} (above 4.5h but short of full 8h-9h shift). Penalized as Half Day.`,
        deductionHours: standardShiftHours / 2,
        deductionAmount: Math.round(dailyRate * 0.5),
        netDayPay: Math.round(dailyRate * 0.5),
        badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
      };
    }

    // 5. Short Leave & Late Morning reporting
    const isLateReporting = inH > 9 || (inH === 9 && inM > 30);
    if (isLateReporting) {
      if (exhaustedShortLeaves) {
        return {
          type: "SHORT_LEAVE_EXHAUSTED",
          status: "1 Hour Pay Deduction",
          description:
            "Allocated Short Leaves / Late Morning allowances are exhausted. 1 hour of pay is deducted for this day.",
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
          badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
        };
      }
    }

    // 6. Full Day Normal Completed
    return {
      type: "FULL_DAY",
      status: "Full Day Present (100% Pay)",
      description: `Completed full scheduled shift duration of ${durationStr}. 100% salary credited.`,
      deductionHours: 0,
      deductionAmount: 0,
      netDayPay: dailyRate,
      badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    };
  };

  const sim = calculateSimulation();

  // 6-Day Off Rule Simulation Calculations
  const simExtraDays = Math.floor(simOffDaysInMonth / 6);
  const simTotalDeductedDays = simOffDaysInMonth + simExtraDays;
  const simOffDeductionAmount = simTotalDeductedDays * dailyRate;
  const simNetPayAfterOff = Math.max(0, monthlySalary - simOffDeductionAmount);

  // Proportionate Deduction Simulation Calculations
  const propRequiredDays = Math.max(0, propTotalDaysInMonth - propFixedOffs);
  const propDaysOffTaken = Math.max(0, propRequiredDays - propWorkedDays);
  const prop6DayPenaltyDays = Math.floor(propDaysOffTaken / 6);
  const propTotalOffsIncludingFixed = propDaysOffTaken + propFixedOffs;
  const propClawbackDays =
    propTotalDaysInMonth > 0 && propDaysOffTaken > 0
      ? Number(((propFixedOffs / propTotalDaysInMonth) * propTotalOffsIncludingFixed).toFixed(2))
      : 0;
  const propTotalDeductedDays = Number(
    (propDaysOffTaken + prop6DayPenaltyDays + propClawbackDays).toFixed(2)
  );
  const propTotalDeductionAmount = Math.round(propTotalDeductedDays * dailyRate);
  const propNetMonthlyPay = Math.max(0, monthlySalary - propTotalDeductionAmount);

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-6 border-b border-slate-100 dark:border-slate-800 gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#293381] dark:text-[#36B4FF]" />
              Salary Calculation & Deduction Policy
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Automated salary calculation formulas, biometric punch deduction rules, and exhausted allowance penalties.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Profile Pre-fill */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-500">Employee:</span>
              <select
                value={selectedEmpId}
                onChange={(e) => handleSelectEmployee(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="CUSTOM">Generic (₹50,000 / 22d / 9h)</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1.5 rounded-lg bg-[#293381]/5 text-[#293381] dark:bg-[#36B4FF]/10 dark:text-[#36B4FF] font-mono font-bold border border-[#293381]/20 dark:border-[#36B4FF]/30">
                Daily Rate: ₹{dailyRate.toLocaleString()}
              </span>
              <span className="px-2.5 py-1.5 rounded-lg bg-[#293381]/5 text-[#293381] dark:bg-[#36B4FF]/10 dark:text-[#36B4FF] font-mono font-bold border border-[#293381]/20 dark:border-[#36B4FF]/30">
                Hourly: ₹{hourlyRate.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 6 Core Rule Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Rule 1: Machine 1 - PV Punch Rules */}
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
                  <strong>Shift Extension</strong>: Reporting within grace period (e.g. 9:30 AM for a 9:00 AM shift) requires completing full shift hours (leave by 6:30 PM).
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

          {/* Rule 5: 6-Day Leave / Off Deduction Rule */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                5. 6-Day Off Deduction Rule
              </h3>
            </div>

            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                <span>
                  <strong>6 Days Off = 7 Days Deducted</strong>: If you are on off for 6 days in a month, salary will be deducted for 7 days (1 extra day deducted).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                <span>
                  <strong>12 Days Off = 14 Days Deducted</strong>: If you are on off for 12 days in a month, salary will be deducted for 14 days (2 extra days deducted).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Cumulative Penalty</strong>: For every 6 days of leave / off in a month, <strong>1 day extra</strong> will be deducted.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Calculation Formula</strong>: <br />
                  <code className="text-[11px] font-mono bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 block mt-1">
                    Extra Days = floor(Off Days / 6)
                  </code>
                  <code className="text-[11px] font-mono bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 block mt-1">
                    Total Deducted = Off Days + Extra Days
                  </code>
                </span>
              </li>
            </ul>
          </div>

          {/* Rule 6: Proportionate Deduction Rule */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Scale className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                6. Proportionate Deduction
              </h3>
            </div>

            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Fixed Offs Identification</strong>: Count all weekly rest days (e.g. 5 Sundays in a 6-day work week) plus gazetted national holidays (e.g. 2nd Oct Gandhi Jayanti) = 6 Fixed Offs.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Required Working Days</strong>: Required days for 100% pay = Total Days of Month &minus; Total Fixed Offs (e.g. 31 &minus; 6 = 25 Days).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Proportionate Clawback Formula</strong>: When taking leave, paid fixed offs are proportionately deducted:
                  <code className="text-[11px] font-mono bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 block mt-1">
                    Clawback = (Fixed Offs / Month Days) &times; (Off Days + Fixed Offs)
                  </code>
                  <code className="text-[11px] font-mono bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 block mt-1">
                    Total Deduction = Off Days + 6-Day Rule + Clawback
                  </code>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <span>
                  <strong>October Case (19 Days Worked)</strong>: 6 Offs taken + 1 (6-day rule) + (6/31 &times; 12) = <strong>9.32 Days Deducted</strong>.
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

      {/* Interactive Monthly 6-Day Off Rule Simulator */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          Interactive Monthly 6-Day Leave / Off Rule Simulator
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          Simulate accumulated leave / off days in a month. For every 6 days on off, 1 additional day of salary is deducted (e.g. 6 days off → 7 days deducted, 12 days off → 14 days deducted).
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4 lg:col-span-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Total Off / Leave Days in Month:
              </label>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {[0, 3, 6, 9, 12, 15, 18].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setSimOffDaysInMonth(days)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                      simOffDaysInMonth === days
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300"
                    }`}
                  >
                    {days} Days Off
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="31"
                  step="1"
                  value={simOffDaysInMonth}
                  onChange={(e) => setSimOffDaysInMonth(Number(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
                <input
                  type="number"
                  min="0"
                  max="31"
                  value={simOffDaysInMonth}
                  onChange={(e) => setSimOffDaysInMonth(Math.max(0, Number(e.target.value)))}
                  className="w-20 text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 text-xs text-purple-900 dark:text-purple-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Rule Execution Breakdown:
              </div>
              <p className="text-[11px] leading-relaxed">
                {simOffDaysInMonth === 0 ? (
                  "0 off days recorded. No leave deduction applied."
                ) : (
                  <>
                    Employee is on off for <strong>{simOffDaysInMonth} days</strong>. Formula applies{" "}
                    <strong>Math.floor({simOffDaysInMonth} / 6) = {simExtraDays} extra day(s)</strong> penalty.
                    Total salary deducted: <strong>{simTotalDeductedDays} days</strong> ({simOffDaysInMonth} base + {simExtraDays} extra).
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Monthly Result Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Monthly Impact
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                  {simTotalDeductedDays} Days Deducted
                </span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <div>Base Off Days: <span className="font-semibold">{simOffDaysInMonth} days</span></div>
                <div>Extra Penalty Days: <span className="font-semibold text-purple-600 dark:text-purple-400">+{simExtraDays} day(s)</span></div>
                <div>Total Days Deducted: <span className="font-semibold text-rose-600 dark:text-rose-400">{simTotalDeductedDays} days</span></div>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Gross Monthly Salary:</span>
                <span className="font-mono font-semibold">₹{monthlySalary.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
                <span>Deduction ({simTotalDeductedDays} days):</span>
                <span className="font-mono font-bold">-₹{simOffDeductionAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Net Estimated Pay:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  ₹{simNetPayAfterOff.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Proportionate Deduction Simulator */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
          <Scale className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          Interactive Proportionate Deduction Simulator
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          Simulate proportionate salary deduction when taking leave. Fixed rest days and national holidays are proportionately clawed back based on actual days worked.
        </p>

        {/* Quick Scenario Presets */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs font-semibold text-slate-500">Quick Test Scenarios:</span>
          <button
            type="button"
            onClick={() => {
              setPropTotalDaysInMonth(31);
              setPropFixedOffs(6);
              setPropWorkedDays(19);
            }}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 transition"
          >
            October Example (19d Worked / 6d Off)
          </button>
          <button
            type="button"
            onClick={() => {
              setPropTotalDaysInMonth(31);
              setPropFixedOffs(6);
              setPropWorkedDays(25);
            }}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition"
          >
            100% Attendance (25d Worked / 0d Off)
          </button>
          <button
            type="button"
            onClick={() => {
              setPropTotalDaysInMonth(31);
              setPropFixedOffs(6);
              setPropWorkedDays(13);
            }}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition"
          >
            Heavy Absence (13d Worked / 12d Off)
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4 lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Total Days in Month
                </label>
                <input
                  type="number"
                  min="28"
                  max="31"
                  value={propTotalDaysInMonth}
                  onChange={(e) => setPropTotalDaysInMonth(Math.max(1, Number(e.target.value)))}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">e.g. 31 days in October</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Total Fixed Offs (Sundays + Holidays)
                </label>
                <input
                  type="number"
                  min="0"
                  max={propTotalDaysInMonth}
                  value={propFixedOffs}
                  onChange={(e) => setPropFixedOffs(Math.max(0, Number(e.target.value)))}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">5 Sundays + 1 Gandhi Jayanti = 6</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Actual Days Worked
                </label>
                <input
                  type="number"
                  min="0"
                  max={propRequiredDays}
                  value={propWorkedDays}
                  onChange={(e) => setPropWorkedDays(Math.max(0, Number(e.target.value)))}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Required: {propRequiredDays} days for 100% pay</span>
              </div>
            </div>

            {/* Step-by-Step Mathematical Audit Card */}
            <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/40 text-xs text-teal-950 dark:text-teal-200 space-y-2.5">
              <div className="font-bold flex items-center gap-1.5 text-teal-900 dark:text-teal-300">
                <Info className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Step-by-Step Calculation Formula:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-lg border border-teal-200/60 dark:border-teal-800/40">
                  <span className="text-slate-500 block">1. Required Working Days:</span>
                  <span className="font-mono font-bold">{propTotalDaysInMonth} - {propFixedOffs} = {propRequiredDays} Days</span>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-lg border border-teal-200/60 dark:border-teal-800/40">
                  <span className="text-slate-500 block">2. Days Off Taken:</span>
                  <span className="font-mono font-bold">{propRequiredDays} - {propWorkedDays} = {propDaysOffTaken} Days</span>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-lg border border-teal-200/60 dark:border-teal-800/40">
                  <span className="text-slate-500 block">3. 6-Day Rule Extra Penalty:</span>
                  <span className="font-mono font-bold">floor({propDaysOffTaken} / 6) = {prop6DayPenaltyDays} Day(s)</span>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-lg border border-teal-200/60 dark:border-teal-800/40">
                  <span className="text-slate-500 block">4. Total Offs Including Fixed:</span>
                  <span className="font-mono font-bold">{propDaysOffTaken} + {propFixedOffs} = {propTotalOffsIncludingFixed} Days</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-teal-300 dark:border-teal-700/60 text-[11px] font-mono">
                <span className="font-bold text-teal-900 dark:text-teal-300">5. Proportionate Deduction Formula:</span>
                <div className="mt-1 text-slate-700 dark:text-slate-300">
                  ({propFixedOffs} / {propTotalDaysInMonth}) &times; {propTotalOffsIncludingFixed} = <strong>{propClawbackDays} Days</strong>
                </div>
                <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-800 text-teal-800 dark:text-teal-300">
                  Total Deduction = {propDaysOffTaken} (Off) + {prop6DayPenaltyDays} (6-Day Penalty) + {propClawbackDays} (Proportionate) = <strong>{propTotalDeductedDays} Days Deducted</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Outcome Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Calculated Outcome
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
                  {propTotalDeductedDays} Days Deducted
                </span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                <div className="flex justify-between">
                  <span>Base Off Days:</span>
                  <span className="font-semibold">{propDaysOffTaken} days</span>
                </div>
                <div className="flex justify-between">
                  <span>6-Day Extra Penalty:</span>
                  <span className="font-semibold text-purple-600 dark:text-purple-400">+{prop6DayPenaltyDays} day(s)</span>
                </div>
                <div className="flex justify-between">
                  <span>Proportionate Clawback:</span>
                  <span className="font-semibold text-teal-600 dark:text-teal-400">+{propClawbackDays} days</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                  <span>Total Deducted Days:</span>
                  <span className="text-rose-600 dark:text-rose-400">{propTotalDeductedDays} days</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Gross Monthly Salary:</span>
                <span className="font-mono font-semibold">₹{monthlySalary.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
                <span>Total Deduction ({propTotalDeductedDays} days):</span>
                <span className="font-mono font-bold">-₹{propTotalDeductionAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Net Estimated Pay:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  ₹{propNetMonthlyPay.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
