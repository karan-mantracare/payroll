import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface LeaveQuota {
  employeeId: string;
  employeeCode?: string;
  privilegeLeave: number;
  casualLeave: number;
  sickLeave: number;
  updatedAt?: number;
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  type: "Gazetted" | "Optional" | "Company Off";
  location: string;
  description?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const QUOTAS_FILE = path.join(DATA_DIR, "leave-quotas.json");
const HOLIDAYS_FILE = path.join(DATA_DIR, "annual-holidays-2026.json");

function ensureDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getLeaveQuotas(): Record<string, LeaveQuota> {
  ensureDirectory();
  try {
    if (!fs.existsSync(QUOTAS_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(QUOTAS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveLeaveQuotas(quotas: Record<string, LeaveQuota>) {
  ensureDirectory();
  fs.writeFileSync(QUOTAS_FILE, JSON.stringify(quotas, null, 2), "utf-8");
}

export function bulkUpdateLeaveQuotas(
  updates: Array<{
    employeeId: string;
    employeeCode?: string;
    privilegeLeave: number;
    casualLeave: number;
    sickLeave: number;
  }>
): Record<string, LeaveQuota> {
  const current = getLeaveQuotas();
  const now = Date.now();

  for (const item of updates) {
    current[item.employeeId] = {
      employeeId: item.employeeId,
      employeeCode: item.employeeCode || current[item.employeeId]?.employeeCode,
      privilegeLeave: Math.max(0, Number(item.privilegeLeave) || 0),
      casualLeave: Math.max(0, Number(item.casualLeave) || 0),
      sickLeave: Math.max(0, Number(item.sickLeave) || 0),
      updatedAt: now,
    };
  }

  saveLeaveQuotas(current);
  return current;
}

export function getHolidayCalendar(): Holiday[] {
  ensureDirectory();
  try {
    if (!fs.existsSync(HOLIDAYS_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(HOLIDAYS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveHolidayCalendar(holidays: Holiday[]) {
  ensureDirectory();
  // Sort chronologically
  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(HOLIDAYS_FILE, JSON.stringify(sorted, null, 2), "utf-8");
}

export function addHoliday(input: Omit<Holiday, "id">): Holiday {
  const holidays = getHolidayCalendar();
  const newHoliday: Holiday = {
    ...input,
    id: `hol_${randomUUID()}`,
  };
  holidays.push(newHoliday);
  saveHolidayCalendar(holidays);
  return newHoliday;
}

export function bulkImportHolidays(newItems: Array<Omit<Holiday, "id">>): Holiday[] {
  const current = getHolidayCalendar();
  const dateMap = new Map<string, Holiday>();

  // Keep existing
  for (const h of current) {
    dateMap.set(`${h.date}_${h.name.toLowerCase()}`, h);
  }

  // Add new
  for (const item of newItems) {
    const key = `${item.date}_${item.name.toLowerCase()}`;
    dateMap.set(key, {
      ...item,
      id: dateMap.get(key)?.id || `hol_${randomUUID()}`,
    });
  }

  const merged = Array.from(dateMap.values());
  saveHolidayCalendar(merged);
  return merged;
}

export function deleteHoliday(id: string): boolean {
  const current = getHolidayCalendar();
  const filtered = current.filter((h) => h.id !== id);
  if (filtered.length !== current.length) {
    saveHolidayCalendar(filtered);
    return true;
  }
  return false;
}

// ==========================================
// LEAVE APPLICATIONS & BALANCES
// ==========================================

export type AbsenceType = "PRIVILEGE_LEAVE" | "CASUAL_LEAVE" | "SICK_LEAVE";
export type LeaveRequestStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface LeaveRequestRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeEmail: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  absenceType: AbsenceType;
  reason: string;
  status: LeaveRequestStatus;
  reviewedByUserId?: string;
  reviewedAt?: number;
  rejectionReason?: string;
  createdAt: number;
  updatedAt: number;
}

const LEAVE_REQUESTS_FILE = path.join(DATA_DIR, "leave-requests.json");

export const DEFAULT_LEAVE_QUOTAS = {
  privilegeLeave: 18,
  casualLeave: 12,
  sickLeave: 10,
};

export function getLeaveRequests(): LeaveRequestRecord[] {
  ensureDirectory();
  try {
    if (!fs.existsSync(LEAVE_REQUESTS_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(LEAVE_REQUESTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLeaveRequests(requests: LeaveRequestRecord[]) {
  ensureDirectory();
  const sorted = [...requests].sort((a, b) => b.createdAt - a.createdAt);
  fs.writeFileSync(LEAVE_REQUESTS_FILE, JSON.stringify(sorted, null, 2), "utf-8");
}

export function calculateInclusiveLeaveDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("INVALID_DATES: Valid start and end dates are required.");
  }
  if (end.getTime() < start.getTime()) {
    throw new Error("INVALID_DATE_RANGE: End date cannot be earlier than start date.");
  }
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

export function getEmployeeLeaveSummary(employeeId: string) {
  const quotas = getLeaveQuotas()[employeeId];
  const quotaPL = quotas ? quotas.privilegeLeave : DEFAULT_LEAVE_QUOTAS.privilegeLeave;
  const quotaCL = quotas ? quotas.casualLeave : DEFAULT_LEAVE_QUOTAS.casualLeave;
  const quotaSL = quotas ? quotas.sickLeave : DEFAULT_LEAVE_QUOTAS.sickLeave;

  const allRequests = getLeaveRequests().filter((r) => r.employeeId === employeeId);

  const sumBy = (type: AbsenceType, status: LeaveRequestStatus) =>
    allRequests
      .filter((r) => r.absenceType === type && r.status === status)
      .reduce((acc, r) => acc + r.totalDays, 0);

  const usedPL = sumBy("PRIVILEGE_LEAVE", "APPROVED");
  const usedCL = sumBy("CASUAL_LEAVE", "APPROVED");
  const usedSL = sumBy("SICK_LEAVE", "APPROVED");

  const pendingPL = sumBy("PRIVILEGE_LEAVE", "PENDING");
  const pendingCL = sumBy("CASUAL_LEAVE", "PENDING");
  const pendingSL = sumBy("SICK_LEAVE", "PENDING");

  return {
    balances: [
      {
        absenceType: "PRIVILEGE_LEAVE" as AbsenceType,
        label: "Privilege Leave",
        quota: quotaPL,
        used: usedPL,
        pending: pendingPL,
        remaining: Math.max(0, quotaPL - usedPL),
      },
      {
        absenceType: "CASUAL_LEAVE" as AbsenceType,
        label: "Casual Leave",
        quota: quotaCL,
        used: usedCL,
        pending: pendingCL,
        remaining: Math.max(0, quotaCL - usedCL),
      },
      {
        absenceType: "SICK_LEAVE" as AbsenceType,
        label: "Sick Leave",
        quota: quotaSL,
        used: usedSL,
        pending: pendingSL,
        remaining: Math.max(0, quotaSL - usedSL),
      },
    ],
    requests: allRequests,
  };
}

export function createLeaveRequest(input: {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeEmail: string;
  startDate: string;
  endDate: string;
  absenceType: AbsenceType;
  reason?: string;
  status: "DRAFT" | "PENDING";
}): LeaveRequestRecord {
  if (!input.startDate || !input.endDate) {
    throw new Error("DATES_REQUIRED: Start date and End date are required.");
  }
  if (
    input.absenceType !== "PRIVILEGE_LEAVE" &&
    input.absenceType !== "CASUAL_LEAVE" &&
    input.absenceType !== "SICK_LEAVE"
  ) {
    throw new Error("ABSENCE_TYPE_REQUIRED: Please select an absence type.");
  }

  const totalDays = calculateInclusiveLeaveDays(input.startDate, input.endDate);
  const summary = getEmployeeLeaveSummary(input.employeeId);
  const balance = summary.balances.find((b) => b.absenceType === input.absenceType);

  if (input.status === "PENDING" && balance) {
    const availableAfterPending = Math.max(0, balance.remaining - balance.pending);
    if (totalDays > availableAfterPending) {
      throw new Error(
        `INSUFFICIENT_BALANCE: Requested ${totalDays} day(s) of ${balance.label}, but only ${availableAfterPending} day(s) available.`
      );
    }
  }

  const now = Date.now();
  const record: LeaveRequestRecord = {
    id: `lr_${randomUUID()}`,
    employeeId: input.employeeId,
    employeeCode: input.employeeCode,
    employeeName: input.employeeName,
    employeeEmail: input.employeeEmail,
    startDate: input.startDate,
    endDate: input.endDate,
    totalDays,
    absenceType: input.absenceType,
    reason: (input.reason || "").trim(),
    status: input.status,
    createdAt: now,
    updatedAt: now,
  };

  const all = getLeaveRequests();
  all.unshift(record);
  saveLeaveRequests(all);
  return record;
}

export function transitionLeaveRequest(params: {
  requestId: string;
  actorEmployeeId?: string | null;
  actorUserId: string;
  isAdmin: boolean;
  action: "APPLY_DRAFT" | "CANCEL" | "APPROVE" | "REJECT";
  rejectionReason?: string;
}): LeaveRequestRecord {
  const all = getLeaveRequests();
  const idx = all.findIndex((r) => r.id === params.requestId);
  if (idx === -1) {
    throw new Error("NOT_FOUND: Leave application not found.");
  }

  const current = all[idx];
  const isOwner = params.actorEmployeeId && current.employeeId === params.actorEmployeeId;
  const now = Date.now();

  if (params.action === "APPLY_DRAFT") {
    if (!isOwner && !params.isAdmin) {
      throw new Error("FORBIDDEN: Cannot submit another employee's draft.");
    }
    if (current.status !== "DRAFT") {
      throw new Error("INVALID_STATE: Only draft applications can be submitted.");
    }
    const summary = getEmployeeLeaveSummary(current.employeeId);
    const balance = summary.balances.find((b) => b.absenceType === current.absenceType);
    if (balance) {
      const available = Math.max(0, balance.remaining - balance.pending);
      if (current.totalDays > available) {
        throw new Error(
          `INSUFFICIENT_BALANCE: Requested ${current.totalDays} day(s), only ${available} day(s) available.`
        );
      }
    }
    all[idx] = { ...current, status: "PENDING", updatedAt: now };
  } else if (params.action === "CANCEL") {
    if (!isOwner && !params.isAdmin) {
      throw new Error("FORBIDDEN: Cannot cancel another employee's leave.");
    }
    if (current.status !== "DRAFT" && current.status !== "PENDING") {
      throw new Error("INVALID_STATE: Only draft or pending leave requests can be cancelled.");
    }
    all[idx] = { ...current, status: "CANCELLED", updatedAt: now };
  } else {
    if (!params.isAdmin) {
      throw new Error("FORBIDDEN: Only HR or Admin can approve/reject leave requests.");
    }
    if (current.status !== "PENDING") {
      throw new Error("INVALID_STATE: Only pending leave requests can be reviewed.");
    }
    all[idx] = {
      ...current,
      status: params.action === "APPROVE" ? "APPROVED" : "REJECTED",
      reviewedByUserId: params.actorUserId,
      reviewedAt: now,
      rejectionReason:
        params.action === "REJECT"
          ? params.rejectionReason?.trim() || "Declined by HR/Admin"
          : undefined,
      updatedAt: now,
    };
  }

  saveLeaveRequests(all);
  return all[idx];
}

