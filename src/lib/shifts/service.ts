import { db } from "../db/client";
import { shifts, shiftAssignments, shiftHistory, employees, users } from "../db/schema";
import { eq, and, or, desc, inArray, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { SessionContext } from "../permissions/types";
import { auditLogger } from "../audit/logger";
import { resolveEmployee, verifyHierarchyScopeAccess } from "../hierarchy/service";

export interface CreateShiftInput {
  name: string;
  code: string;
  startTime: string; // "09:00"
  endTime: string; // "18:00"
  breakDurationMinutes?: number;
  isOvernight?: boolean;
  colorCode?: string;
  organizationId?: string;
}

export interface AssignShiftInput {
  employeeIdOrCode: string;
  shiftId: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (optional)
  patternDays?: string[]; // e.g. ["MON", "TUE", "WED", "THU", "FRI"]
  reason?: string;
}

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/**
 * Lists all active shifts defined for an organization.
 */
export async function listShifts(session?: SessionContext) {
  return await db
    .select()
    .from(shifts)
    .where(eq(shifts.isActive, true))
    .orderBy(shifts.startTime);
}

/**
 * Creates a new shift definition.
 */
export async function createShift(
  session: SessionContext,
  input: CreateShiftInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const canManage =
    session.isSuperAdmin ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes("admin.shifts.manage");

  if (!canManage) {
    throw new Error("UNAUTHORIZED: Insufficient permissions to create shifts.");
  }

  // Validate format
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endTime)) {
    throw new Error("INVALID_TIME_FORMAT: Shift timings must be provided in HH:mm 24-hour format.");
  }

  const existing = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(eq(shifts.code, input.code.toUpperCase().trim()))
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`SHIFT_CODE_EXISTS: Shift with code '${input.code}' already exists.`);
  }

  const now = Date.now();
  const shiftId = `shift_${randomUUID()}`;

  const newShift = {
    id: shiftId,
    organizationId: input.organizationId || session.organizationId || "org_mc_global",
    name: input.name.trim(),
    code: input.code.toUpperCase().trim(),
    startTime: input.startTime,
    endTime: input.endTime,
    breakDurationMinutes: input.breakDurationMinutes ?? 60,
    isOvernight: input.isOvernight ?? false,
    colorCode: input.colorCode || "#36B4FF",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(shifts).values(newShift);

  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "SHIFT_CREATED",
    targetEntity: "shifts",
    targetId: shiftId,
    changes: newShift,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return newShift;
}

/**
 * Assigns an employee to a shift schedule, terminating prior ongoing assignments.
 */
export async function assignShiftToEmployee(
  session: SessionContext,
  input: AssignShiftInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const canManage =
    session.isSuperAdmin ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes("admin.shifts.manage");

  if (!canManage) {
    throw new Error("UNAUTHORIZED: Insufficient permissions to assign shifts.");
  }

  const employee = await resolveEmployee(input.employeeIdOrCode);
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND: Target employee record does not exist.");
  }

  await verifyHierarchyScopeAccess(session, employee);

  const shiftRows = await db.select().from(shifts).where(eq(shifts.id, input.shiftId)).limit(1);
  if (shiftRows.length === 0) {
    throw new Error("SHIFT_NOT_FOUND: Target shift does not exist.");
  }

  const targetShift = shiftRows[0];
  const now = Date.now();

  // Find currently active assignment
  const currentAssignments = await db
    .select()
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.employeeId, employee.id),
        or(
          eq(shiftAssignments.endDate, ""),
          // @ts-ignore
          eq(shiftAssignments.endDate, null),
          gte(shiftAssignments.endDate, input.startDate)
        )
      )
    );

  const prevShiftId = currentAssignments.length > 0 ? currentAssignments[0].shiftId : null;

  // Close previous assignment
  for (const prev of currentAssignments) {
    await db
      .update(shiftAssignments)
      .set({ endDate: input.startDate, updatedAt: now })
      .where(eq(shiftAssignments.id, prev.id));
  }

  const assignmentId = `sa_${randomUUID()}`;
  const patternDays = input.patternDays || ["MON", "TUE", "WED", "THU", "FRI"];

  await db.insert(shiftAssignments).values({
    id: assignmentId,
    employeeId: employee.id,
    shiftId: targetShift.id,
    startDate: input.startDate,
    endDate: input.endDate || null,
    patternDays: JSON.stringify(patternDays),
    assignedByUserId: session.userId,
    createdAt: now,
    updatedAt: now,
  });

  // Record history
  await db.insert(shiftHistory).values({
    id: `sh_${randomUUID()}`,
    employeeId: employee.id,
    previousShiftId: prevShiftId,
    newShiftId: targetShift.id,
    effectiveDate: input.startDate,
    reason: input.reason || "Shift assignment updated by HR",
    changedByUserId: session.userId,
    createdAt: now,
  });

  // Log audit
  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "SHIFT_ASSIGNED",
    targetEntity: "shift_assignments",
    targetId: assignmentId,
    changes: {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      shiftCode: targetShift.code,
      shiftName: targetShift.name,
      startDate: input.startDate,
      endDate: input.endDate || null,
      patternDays,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    assignmentId,
    employeeId: employee.id,
    shiftId: targetShift.id,
    shiftCode: targetShift.code,
    shiftName: targetShift.name,
    startDate: input.startDate,
    patternDays,
  };
}

/**
 * Resolves which shift applies to an employee on a specific date (YYYY-MM-DD).
 */
export async function getEmployeeShiftForDate(employeeIdOrCode: string, dateStr: string) {
  const employee = await resolveEmployee(employeeIdOrCode);
  if (!employee) return null;

  const dateObj = new Date(`${dateStr}T12:00:00Z`);
  const dayName = DAY_NAMES[dateObj.getUTCDay()]; // e.g. "MON"

  // Query shift assignments overlapping this date
  const assignments = await db
    .select({
      assignmentId: shiftAssignments.id,
      shiftId: shiftAssignments.shiftId,
      startDate: shiftAssignments.startDate,
      endDate: shiftAssignments.endDate,
      patternDays: shiftAssignments.patternDays,
      shiftName: shifts.name,
      shiftCode: shifts.code,
      startTime: shifts.startTime,
      endTime: shifts.endTime,
      breakDurationMinutes: shifts.breakDurationMinutes,
      isOvernight: shifts.isOvernight,
      colorCode: shifts.colorCode,
    })
    .from(shiftAssignments)
    .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
    .where(
      and(
        eq(shiftAssignments.employeeId, employee.id),
        lte(shiftAssignments.startDate, dateStr)
      )
    )
    .orderBy(desc(shiftAssignments.startDate));

  for (const a of assignments) {
    if (a.endDate && a.endDate < dateStr) {
      continue;
    }
    const days: string[] = JSON.parse(a.patternDays || "[]");
    const isWorkingDay = days.includes(dayName);

    return {
      ...a,
      isWorkingDay,
      dayOfWeek: dayName,
    };
  }

  // Fallback: default general shift
  const defaultShifts = await db.select().from(shifts).where(eq(shifts.code, "GENERAL")).limit(1);
  if (defaultShifts.length > 0) {
    const gen = defaultShifts[0];
    const isWorkingDay = dayName !== "SAT" && dayName !== "SUN";
    return {
      assignmentId: "default",
      shiftId: gen.id,
      shiftName: gen.name,
      shiftCode: gen.code,
      startTime: gen.startTime,
      endTime: gen.endTime,
      breakDurationMinutes: gen.breakDurationMinutes,
      isOvernight: gen.isOvernight,
      colorCode: gen.colorCode,
      isWorkingDay,
      dayOfWeek: dayName,
    };
  }

  return null;
}

/**
 * Returns an employee's shift schedule across a date range.
 */
export async function getEmployeeShiftCalendar(
  session: SessionContext,
  employeeIdOrCode: string,
  startDateStr: string,
  endDateStr: string
) {
  const employee = await resolveEmployee(employeeIdOrCode);
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND: Target employee record not found.");
  }

  await verifyHierarchyScopeAccess(session, employee);

  const schedule: any[] = [];
  const curr = new Date(`${startDateStr}T12:00:00Z`);
  const end = new Date(`${endDateStr}T12:00:00Z`);

  while (curr <= end) {
    const dateStr = curr.toISOString().split("T")[0];
    const shiftInfo = await getEmployeeShiftForDate(employee.id, dateStr);
    schedule.push({
      date: dateStr,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      shift: shiftInfo,
    });
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return schedule;
}

