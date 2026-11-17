/**
 * Utility functions for computing Day Pay Impact and Monthly Salary Impact
 * based on biometric punch logs, shift policies, and attendance deduction rules.
 */

export interface AttendanceRecordLike {
  id?: string;
  employeeId?: string;
  employeeCode?: string;
  employeeName?: string;
  date: string;
  shiftName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  checkInTimeUtc?: string | null;
  checkOutTimeUtc?: string | null;
  totalWorkMinutes?: number;
  status?: string;
  lateMinutes?: number;
  earlyExitMinutes?: number;
  source?: string;
  notes?: string | null;
}

export type PayImpactType =
  | "FULL_PAY"
  | "HALF_DAY"
  | "FULL_DAY_LOP"
  | "LATE_PENALTY"
  | "LATE_COVERED"
  | "ON_LEAVE"
  | "WEEK_OFF";

export type SetOffType =
  | "Grace Period"
  | "Short Leave"
  | "Leave"
  | "Half Day"
  | "Shift Exception"
  | "Comp Off"
  | "None";

export interface DayPayImpact {
  recordId?: string;
  employeeId?: string;
  employeeCode?: string;
  employeeName?: string;
  date: string;
  dayOfWeek: string;
  shiftName: string;
  scheduledShiftTiming: string;
  effectiveShiftTiming: string;
  hasGraceApplied: boolean;
  setOff: SetOffType;
  checkIn: string;
  checkOut: string;
  durationMinutes: number;
  durationFormatted: string;
  status: string;
  notes: string;
  source: string;

  // Pay Impact
  impactType: PayImpactType;
  badgeLabel: string;
  badgeColor: "emerald" | "amber" | "rose" | "orange" | "blue" | "slate";
  payPercentage: number; // e.g. 100, 50, 0
  deductionHours: number;
  deductionAmount: number;
  netDayPay: number;
  reason: string;
}

export interface MonthlyPaySummary {
  month: string;
  monthlySalary: number;
  workingDaysInMonth: number;
  standardShiftHours: number;
  dailyRate: number;
  hourlyRate: number;

  totalDaysTracked: number;
  fullPayDays: number;
  halfDayCount: number;
  fullDayLopCount: number;
  latePenaltyCount: number;
  shortLeaveCoveredCount: number;

  totalDeductions: number;
  totalNetPay: number;
  effectivePayableDays: number;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface CalculateDayPayImpactOptions {
  monthlySalary?: number;
  workingDaysInMonth?: number;
  standardShiftHours?: number;
  shortLeaveIndex?: number;
  maxShortLeavesAllowed?: number;
}

/**
 * Calculates the exact salary impact for a single day's attendance record.
 */
export function calculateDayPayImpact(
  record: AttendanceRecordLike,
  options: CalculateDayPayImpactOptions = {}
): DayPayImpact {
  const monthlySalary = options.monthlySalary ?? 50000;
  const workingDaysInMonth = options.workingDaysInMonth ?? 22;
  const standardShiftHours = options.standardShiftHours ?? 9;

  const dailyRate = Math.round(monthlySalary / workingDaysInMonth);
  const hourlyRate = Math.round(dailyRate / standardShiftHours);

  const recordDate = new Date(record.date);
  const dayOfWeek = isNaN(recordDate.getTime())
    ? "--"
    : DAYS_OF_WEEK[recordDate.getUTCDay()];

  const notes = record.notes || "";
  const status = (record.status || "PRESENT").toUpperCase();
  const totalMinutes = record.totalWorkMinutes ?? 0;
  const durationHours = Math.floor(totalMinutes / 60);
  const durationMins = totalMinutes % 60;
  const durationFormatted =
    totalMinutes > 0 ? `${durationHours}h ${durationMins}m` : "--";

  const hasCheckIn = Boolean(record.checkInTimeUtc);
  const hasCheckOut = Boolean(record.checkOutTimeUtc);

  // Format check-in / check-out times
  const formatTime = (iso?: string | null) => {
    if (!iso) return "--";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return iso;
    }
  };

  const checkIn = formatTime(record.checkInTimeUtc);
  const checkOut = formatTime(record.checkOutTimeUtc);

  // Resolve Scheduled and Effective Shift Timing (Accounting for Grace Period)
  let rawStartTime = record.shiftStartTime || "";
  let rawEndTime = record.shiftEndTime || "";

  if (!rawStartTime) {
    if (record.shiftName?.includes("08:30")) {
      rawStartTime = "08:30";
      rawEndTime = "17:30";
    } else if (record.shiftName?.includes("09:30")) {
      rawStartTime = "09:30";
      rawEndTime = "18:30";
    } else if (record.shiftName?.includes("12:00")) {
      rawStartTime = "12:00";
      rawEndTime = "21:00";
    } else if (record.shiftName?.includes("18:00")) {
      rawStartTime = "18:00";
      rawEndTime = "06:00";
    } else {
      rawStartTime = "09:00";
      rawEndTime = "18:00";
    }
  }

  const scheduledShiftTiming = `${rawStartTime} - ${rawEndTime}`;
  let effectiveShiftTiming = scheduledShiftTiming;
  let hasGraceApplied = false;

  // Grace Period Rule:
  // Policy allows 30 minutes grace period for morning shifts (08:30, 09:00, 09:30).
  // - 09:00 General Day Shift: check-in between 09:01 and 09:35 applies 09:30 - 18:30 (Grace Period).
  // - 09:30 Flexible Morning: check-in between 09:31 and 10:05 (e.g. 09:35) is reporting within grace window -> Grace Period.
  // - 08:30 Morning Shift: check-in between 08:31 and 09:05 is reporting within grace window -> Grace Period.
  // Afternoon shift (12:00 - 21:00):
  // - Check-in at 12:35 is a late arrival covered by Short Leave allowance (NOT Grace Period).
  const isMorningShift =
    rawStartTime === "09:00" ||
    rawStartTime === "09:30" ||
    rawStartTime === "08:30" ||
    record.shiftName?.includes("09:00") ||
    record.shiftName?.includes("09:30") ||
    record.shiftName?.includes("08:30") ||
    record.shiftName?.toLowerCase().includes("general day") ||
    record.shiftName?.toLowerCase().includes("flexible morning") ||
    record.shiftName?.toLowerCase().includes("morning");

  if (checkIn && checkIn !== "--" && isMorningShift) {
    const [inH, inM] = checkIn.split(":").map(Number);
    const [startH, startM] = rawStartTime.split(":").map(Number);
    const inTotalMins = inH * 60 + inM;
    const startTotalMins = startH * 60 + startM;
    const lateMins = inTotalMins - startTotalMins;

    // Reporting within grace window (up to 35 minutes after scheduled start)
    if (lateMins > 0 && lateMins <= 35) {
      hasGraceApplied = true;
      if (
        rawStartTime === "09:00" ||
        record.shiftName?.includes("09:00") ||
        record.shiftName?.toLowerCase().includes("general day")
      ) {
        effectiveShiftTiming = "09:30 - 18:30 (Grace Period)";
      } else {
        effectiveShiftTiming = scheduledShiftTiming;
      }
    }
  }

  // Determine if arrival is late (late morning / late arrival)
  const isLateArrival = Boolean(
    checkIn &&
      checkIn !== "--" &&
      (() => {
        const [inH, inM] = checkIn.split(":").map(Number);
        const [startH, startM] = rawStartTime.split(":").map(Number);
        return inH * 60 + inM > startH * 60 + startM;
      })()
  );

  const hasShortLeaveNote =
    notes.toLowerCase().includes("short leave") ||
    notes.toLowerCase().includes("late arrival") ||
    notes.toLowerCase().includes("late morning");

  // Late arrival covered by Short Leave applies when:
  // - Grace period did NOT apply
  // - And employee arrived late and completed full working hours (>= 510 mins, i.e. 8.5h - 9h),
  //   such as the Afternoon Shift (12:00 shift in-time 12:35) or morning shifts arriving past grace (> 35m late)
  const isLateMorningCovered =
    !hasGraceApplied &&
    (isLateArrival && totalMinutes >= 510);

  let impactType: PayImpactType = "FULL_PAY";
  let badgeLabel = "Full Pay (100%)";
  let badgeColor: "emerald" | "amber" | "rose" | "orange" | "blue" | "slate" =
    "emerald";
  let payPercentage = 100;
  let deductionHours = 0;
  let deductionAmount = 0;
  let netDayPay = dailyRate;

  let reason = "Full scheduled shift completed - 100% pay credited.";
  if (hasGraceApplied) {
    if (
      rawStartTime === "09:00" ||
      record.shiftName?.includes("09:00") ||
      record.shiftName?.toLowerCase().includes("general day")
    ) {
      reason = `Shift 09:30 - 18:30 applied (Grace Period). Completed 9h shift - 100% pay credited.`;
    } else {
      reason = `Shift ${scheduledShiftTiming} completed with Grace Period applied (In: ${checkIn}). 100% pay credited.`;
    }
  } else if (isLateMorningCovered) {
    reason = `Late morning arrival (${checkIn}) covered by Short Leave allowance. Completed ${durationFormatted} - 100% pay credited.`;
  }

  // Rule 1: Unauthorized Shift Deduction
  if (notes.toLowerCase().includes("unauthorized shift")) {
    if (notes.toLowerCase().includes("half day") || status === "HALF_DAY") {
      impactType = "HALF_DAY";
      badgeLabel = "Half Day LOP (-50%)";
      badgeColor = "amber";
      payPercentage = 50;
      deductionHours = standardShiftHours / 2;
      deductionAmount = Math.round(dailyRate * 0.5);
      netDayPay = dailyRate - deductionAmount;
      reason = "Reported to unauthorized shift without exception - Half day deduction applied.";
    } else {
      impactType = "FULL_DAY_LOP";
      badgeLabel = "Full Day LOP (-100%)";
      badgeColor = "rose";
      payPercentage = 0;
      deductionHours = standardShiftHours;
      deductionAmount = dailyRate;
      netDayPay = 0;
      reason = "Reported to unauthorized shift without exception - Full day loss of pay applied.";
    }
  }
  // Rule 2: Single Punch Missing (Entry Missing) -> Half Day
  else if (
    (!hasCheckIn || !hasCheckOut) &&
    (status === "HALF_DAY" || notes.toLowerCase().includes("missing") || notes.toLowerCase().includes("single punch"))
  ) {
    impactType = "HALF_DAY";
    badgeLabel = "Half Day LOP (-50%)";
    badgeColor = "amber";
    payPercentage = 50;
    deductionHours = standardShiftHours / 2;
    deductionAmount = Math.round(dailyRate * 0.5);
    netDayPay = dailyRate - deductionAmount;
    reason = "Single punch recorded (Entry Missing: Check-In or Check-Out missing) - Half day deducted.";
  }
  // Rule 3: Worked < 4 hrs 30 mins (270 min) -> Off / Full Day Loss of Pay
  else if (
    (hasCheckIn && hasCheckOut && totalMinutes > 0 && totalMinutes < 270) ||
    status === "OFF" ||
    status === "ABSENT" ||
    notes.toLowerCase().includes("under 4.5h") ||
    notes.toLowerCase().includes("counted as off")
  ) {
    impactType = "FULL_DAY_LOP";
    badgeLabel = "Full Day LOP (-100%)";
    badgeColor = "rose";
    payPercentage = 0;
    deductionHours = standardShiftHours;
    deductionAmount = dailyRate;
    netDayPay = 0;
    reason =
      totalMinutes > 0
        ? `Total worked duration ${durationFormatted} is below 4h 30m minimum threshold - Counted as Off with full day pay deduction.`
        : "Absent from work schedule - Full day loss of pay.";
  }
  // Rule 4: Half Day (worked >= 4h 30m but short of full shift)
  else if (status === "HALF_DAY") {
    impactType = "HALF_DAY";
    badgeLabel = "Half Day LOP (-50%)";
    badgeColor = "amber";
    payPercentage = 50;
    deductionHours = standardShiftHours / 2;
    deductionAmount = Math.round(dailyRate * 0.5);
    netDayPay = dailyRate - deductionAmount;
    reason = `Worked ${durationFormatted}. Met 4h 30m threshold but incomplete full shift - Half day deducted.`;
  }
  // Rule 5: Late Reporting & Short Leaves
  else if (status === "LATE" || isLateMorningCovered) {
    const isExhaustedByCount =
      options.shortLeaveIndex !== undefined &&
      options.maxShortLeavesAllowed !== undefined &&
      options.shortLeaveIndex > options.maxShortLeavesAllowed;

    const isExhausted =
      isExhaustedByCount ||
      notes.toLowerCase().includes("deducted") ||
      notes.toLowerCase().includes("exhausted") ||
      notes.toLowerCase().includes("1 hr");

    if (isExhausted) {
      impactType = "LATE_PENALTY";
      badgeLabel = "Late (-1 Hr Pay)";
      badgeColor = "orange";
      payPercentage = Math.round(((standardShiftHours - 1) / standardShiftHours) * 100);
      deductionHours = 1;
      deductionAmount = hourlyRate;
      netDayPay = Math.max(0, dailyRate - deductionAmount);
      const countInfo =
        options.shortLeaveIndex && options.maxShortLeavesAllowed
          ? ` (${options.shortLeaveIndex}th used, ${options.maxShortLeavesAllowed} allowed)`
          : "";
      reason = `Late arrival beyond grace time${countInfo} - 1 hour pay deducted (₹${hourlyRate.toLocaleString("en-IN")}). Completed ${durationFormatted}.`;
    } else {
      impactType = "FULL_PAY";
      badgeLabel = "Full Pay (100%)";
      badgeColor = "emerald";
      payPercentage = 100;
      deductionHours = 0;
      deductionAmount = 0;
      netDayPay = dailyRate;
      const countInfo =
        options.shortLeaveIndex && options.maxShortLeavesAllowed
          ? ` (${options.shortLeaveIndex} of ${options.maxShortLeavesAllowed} used)`
          : "";
      reason = `Late morning arrival (${checkIn}) covered by Short Leave allowance${countInfo}. Completed ${durationFormatted} - 100% pay credited.`;
    }
  }
  // Rule 6: Approved Leave
  else if (status === "ON_LEAVE") {
    impactType = "ON_LEAVE";
    badgeLabel = "Paid Leave (100%)";
    badgeColor = "blue";
    payPercentage = 100;
    deductionHours = 0;
    deductionAmount = 0;
    netDayPay = dailyRate;
    reason = "Approved company leave - 100% pay credited.";
  }

  // Determine Set-off Option Applied
  let setOff: SetOffType = "None";
  if (hasGraceApplied) {
    setOff = "Grace Period";
  } else if (
    isLateMorningCovered ||
    (!hasGraceApplied && (
      notes.toLowerCase().includes("short leave") ||
      notes.toLowerCase().includes("late morning") ||
      notes.toLowerCase().includes("late arrival")
    ))
  ) {
    setOff = "Short Leave";
  } else if (
    status === "ON_LEAVE" ||
    status === "LEAVE" ||
    impactType === "ON_LEAVE" ||
    notes.toLowerCase().includes("leave")
  ) {
    setOff = "Leave";
  } else if (
    notes.toLowerCase().includes("shift exception") ||
    notes.toLowerCase().includes("exception authorized")
  ) {
    setOff = "Shift Exception";
  } else if (
    notes.toLowerCase().includes("comp off") ||
    notes.toLowerCase().includes("compensatory")
  ) {
    setOff = "Comp Off";
  } else if (
    status === "HALF_DAY" ||
    impactType === "HALF_DAY" ||
    notes.toLowerCase().includes("half day")
  ) {
    setOff = "Half Day";
  }

  // Clean up contradictory notes text when Grace Period applies or Short Leave is exhausted
  let displayNotes = notes;
  if (hasGraceApplied) {
    displayNotes = displayNotes
      .replace(/\|\s*Late morning reporting covered by Short Leave allowance/gi, "| Reporting within Grace Period")
      .replace(/Late morning reporting covered by Short Leave allowance/gi, "Reporting within Grace Period")
      .replace(/\|\s*late arrival covered by short leave allowance/gi, "| Reporting within Grace Period")
      .replace(/late arrival covered by short leave allowance/gi, "Reporting within Grace Period");
  } else if (impactType === "LATE_PENALTY" && (isLateMorningCovered || status === "LATE")) {
    const countNote =
      options.shortLeaveIndex && options.maxShortLeavesAllowed
        ? `Short Leave allowance exhausted (${options.shortLeaveIndex} of ${options.maxShortLeavesAllowed} allowed) - 1h pay deducted`
        : "Short Leave allowance exhausted - 1h pay deducted";
    displayNotes = displayNotes
      .replace(/\|\s*Late morning reporting covered by Short Leave allowance/gi, `| ${countNote}`)
      .replace(/Late morning reporting covered by Short Leave allowance/gi, countNote)
      .replace(/\|\s*late arrival covered by short leave allowance/gi, `| ${countNote}`)
      .replace(/late arrival covered by short leave allowance/gi, countNote);
  }

  return {
    recordId: record.id,
    employeeId: record.employeeId,
    employeeCode: record.employeeCode,
    employeeName: record.employeeName,
    date: record.date,
    dayOfWeek,
    shiftName: record.shiftName || "General Shift",
    scheduledShiftTiming,
    effectiveShiftTiming,
    hasGraceApplied,
    setOff,
    checkIn,
    checkOut,
    durationMinutes: totalMinutes,
    durationFormatted,
    status,
    notes: displayNotes,
    source: record.source || "SYSTEM",

    impactType,
    badgeLabel,
    badgeColor,
    payPercentage,
    deductionHours,
    deductionAmount,
    netDayPay,
    reason,
  };
}

/**
 * Computes monthly summary metrics from a collection of day impact calculations.
 */
export function calculateMonthlyPaySummary(
  dayImpacts: DayPayImpact[],
  options: {
    month: string;
    monthlySalary?: number;
    workingDaysInMonth?: number;
    standardShiftHours?: number;
  }
): MonthlyPaySummary {
  const monthlySalary = options.monthlySalary ?? 50000;
  const workingDaysInMonth = options.workingDaysInMonth ?? 22;
  const standardShiftHours = options.standardShiftHours ?? 9;

  const dailyRate = Math.round(monthlySalary / workingDaysInMonth);
  const hourlyRate = Math.round(dailyRate / standardShiftHours);

  let fullPayDays = 0;
  let halfDayCount = 0;
  let fullDayLopCount = 0;
  let latePenaltyCount = 0;
  let shortLeaveCoveredCount = 0;
  let totalDeductions = 0;
  let totalEarnedPay = 0;

  for (const item of dayImpacts) {
    totalDeductions += item.deductionAmount;
    totalEarnedPay += item.netDayPay;

    switch (item.impactType) {
      case "FULL_PAY":
      case "ON_LEAVE":
        fullPayDays += 1;
        break;
      case "HALF_DAY":
        halfDayCount += 1;
        break;
      case "FULL_DAY_LOP":
        fullDayLopCount += 1;
        break;
      case "LATE_PENALTY":
        latePenaltyCount += 1;
        break;
      case "LATE_COVERED":
        shortLeaveCoveredCount += 1;
        fullPayDays += 1;
        break;
    }
  }

  // Effective payable days (Full days + half days + late penalty days minus the 1 deducted hour)
  const effectivePayableDays =
    fullPayDays +
    halfDayCount * 0.5 +
    latePenaltyCount * ((standardShiftHours - 1) / standardShiftHours);

  return {
    month: options.month,
    monthlySalary,
    workingDaysInMonth,
    standardShiftHours,
    dailyRate,
    hourlyRate,

    totalDaysTracked: dayImpacts.length,
    fullPayDays,
    halfDayCount,
    fullDayLopCount,
    latePenaltyCount,
    shortLeaveCoveredCount,

    totalDeductions,
    totalNetPay: totalEarnedPay,
    effectivePayableDays: Math.max(0, Number(effectivePayableDays.toFixed(2))),
  };
}

/**
 * Computes Day Pay Impacts for a batch/month of attendance records, tracking
 * monthly Short Leave quota consumption chronologically per employee.
 */
export function calculateBatchDayPayImpacts(
  records: AttendanceRecordLike[],
  options: {
    monthlySalary?: number;
    workingDaysInMonth?: number;
    standardShiftHours?: number;
    employeePolicies?: Record<string, { shortLeaveAllowed?: number; [key: string]: any }>;
    defaultShortLeaveAllowed?: number;
  } = {}
): DayPayImpact[] {
  // Map records with their original index to preserve input order
  const indexed = records.map((record, index) => ({ record, index }));

  // Group by employee
  const employeeGroups = new Map<string, typeof indexed>();
  for (const item of indexed) {
    const key = (item.record.employeeCode || item.record.employeeId || "unknown").toUpperCase();
    if (!employeeGroups.has(key)) {
      employeeGroups.set(key, []);
    }
    employeeGroups.get(key)!.push(item);
  }

  const results: DayPayImpact[] = new Array(records.length);

  for (const [empKey, group] of employeeGroups.entries()) {
    // Sort employee records chronologically ascending by date
    group.sort((a, b) => a.record.date.localeCompare(b.record.date));

    // Lookup policy for this employee
    const policy =
      options.employeePolicies?.[empKey] ||
      Object.values(options.employeePolicies || {}).find(
        (p: any) =>
          (p.employeeCode && p.employeeCode.toUpperCase() === empKey) ||
          (p.employeeId && p.employeeId.toUpperCase() === empKey)
      );
    const maxShortLeaves = policy?.shortLeaveAllowed ?? options.defaultShortLeaveAllowed ?? 3;

    let shortLeaveCount = 0;

    for (const item of group) {
      // First, determine if this record qualifies as a Short Leave
      const baseEvaluation = calculateDayPayImpact(item.record, {
        monthlySalary: options.monthlySalary,
        workingDaysInMonth: options.workingDaysInMonth,
        standardShiftHours: options.standardShiftHours,
      });

      let shortLeaveIndex: number | undefined = undefined;
      if (baseEvaluation.setOff === "Short Leave") {
        shortLeaveCount++;
        shortLeaveIndex = shortLeaveCount;
      }

      // Compute final impact with shortLeaveIndex and maxShortLeavesAllowed
      const finalImpact = calculateDayPayImpact(item.record, {
        monthlySalary: options.monthlySalary,
        workingDaysInMonth: options.workingDaysInMonth,
        standardShiftHours: options.standardShiftHours,
        shortLeaveIndex,
        maxShortLeavesAllowed: maxShortLeaves,
      });

      results[item.index] = finalImpact;
    }
  }

  return results;
}
