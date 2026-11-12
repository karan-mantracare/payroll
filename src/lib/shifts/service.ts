import { db } from "../db/client";
import { shifts, shiftAssignments, shiftHistory, shiftChangeRequests, employees, users } from "../db/schema";
import { eq, and, or, desc, inArray, gte, lte, ne } from "drizzle-orm";
import { randomUUID } from "crypto";
import { SessionContext } from "../permissions/types";
import { auditLogger } from "../audit/logger";
import { resolveEmployee, verifyHierarchyScopeAccess } from "../hierarchy/service";
import {
  createNotification,
  notifyAdmins,
  resolveUserIdForEmployee,
} from "../notifications/service";

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

export interface UpdateShiftInput {
  id: string;
  name?: string;
  code?: string;
  startTime?: string;
  endTime?: string;
  breakDurationMinutes?: number;
  isOvernight?: boolean;
  colorCode?: string;
  isActive?: boolean;
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
 * Updates an existing shift definition.
 */
export async function updateShift(
  session: SessionContext,
  input: UpdateShiftInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const canManage =
    session.isSuperAdmin ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes("admin.shifts.manage");

  if (!canManage) {
    throw new Error("UNAUTHORIZED: Insufficient permissions to edit shifts.");
  }

  const existing = await db
    .select()
    .from(shifts)
    .where(eq(shifts.id, input.id))
    .limit(1);

  if (existing.length === 0) {
    throw new Error("SHIFT_NOT_FOUND: Target shift does not exist.");
  }

  const currentShift = existing[0];

  // If code is being changed, check uniqueness
  if (input.code && input.code.toUpperCase().trim() !== currentShift.code) {
    const codeConflict = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(and(eq(shifts.code, input.code.toUpperCase().trim()), ne(shifts.id, input.id)))
      .limit(1);

    if (codeConflict.length > 0) {
      throw new Error(`SHIFT_CODE_EXISTS: Shift with code '${input.code}' already exists.`);
    }
  }

  // Validate format if provided
  if (input.startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) {
    throw new Error("INVALID_TIME_FORMAT: Shift start time must be in HH:mm 24-hour format.");
  }
  if (input.endTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endTime)) {
    throw new Error("INVALID_TIME_FORMAT: Shift end time must be in HH:mm 24-hour format.");
  }

  const now = Date.now();
  const updatedFields: Partial<typeof shifts.$inferInsert> = {
    updatedAt: now,
  };

  if (input.name !== undefined) updatedFields.name = input.name.trim();
  if (input.code !== undefined) updatedFields.code = input.code.toUpperCase().trim();
  if (input.startTime !== undefined) updatedFields.startTime = input.startTime;
  if (input.endTime !== undefined) updatedFields.endTime = input.endTime;
  if (input.breakDurationMinutes !== undefined) updatedFields.breakDurationMinutes = input.breakDurationMinutes;
  if (input.isOvernight !== undefined) updatedFields.isOvernight = input.isOvernight;
  if (input.colorCode !== undefined) updatedFields.colorCode = input.colorCode;
  if (input.isActive !== undefined) updatedFields.isActive = input.isActive;

  await db.update(shifts).set(updatedFields).where(eq(shifts.id, input.id));

  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "SHIFT_UPDATED",
    targetEntity: "shifts",
    targetId: input.id,
    changes: updatedFields,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return { ...currentShift, ...updatedFields };
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
  const patternDays = input.patternDays || ["MON", "TUE", "WED", "THU", "FRI"];

  return applyShiftAssignment(
    session.userId,
    session.employeeId,
    employee,
    targetShift,
    input.startDate,
    input.endDate,
    patternDays,
    input.reason || "Shift assignment updated by HR",
    meta
  );
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

export interface ShiftChangeRequestInput {
  requestedShiftId: string;
  effectiveDate: string; // YYYY-MM-DD
  endDate?: string;
  requestedPatternDays?: string[];
  reason: string;
}

async function applyShiftAssignment(
  actorUserId: string,
  actorEmployeeId: string | undefined,
  employee: { id: string; employeeCode: string },
  targetShift: typeof shifts.$inferSelect,
  startDate: string,
  endDate: string | null | undefined,
  patternDays: string[],
  reason: string,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const now = Date.now();
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
          gte(shiftAssignments.endDate, startDate)
        )
      )
    );

  const prevShiftId = currentAssignments.length > 0 ? currentAssignments[0].shiftId : null;

  for (const prev of currentAssignments) {
    await db
      .update(shiftAssignments)
      .set({ endDate: startDate, updatedAt: now })
      .where(eq(shiftAssignments.id, prev.id));
  }

  const assignmentId = `sa_${randomUUID()}`;
  await db.insert(shiftAssignments).values({
    id: assignmentId,
    employeeId: employee.id,
    shiftId: targetShift.id,
    startDate,
    endDate: endDate || null,
    patternDays: JSON.stringify(patternDays),
    assignedByUserId: actorUserId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(shiftHistory).values({
    id: `sh_${randomUUID()}`,
    employeeId: employee.id,
    previousShiftId: prevShiftId,
    newShiftId: targetShift.id,
    effectiveDate: startDate,
    reason,
    changedByUserId: actorUserId,
    createdAt: now,
  });

  await auditLogger.logAuditEvent({
    actorUserId,
    actorEmployeeId,
    action: "SHIFT_ASSIGNED",
    targetEntity: "shift_assignments",
    targetId: assignmentId,
    changes: {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      shiftCode: targetShift.code,
      shiftName: targetShift.name,
      startDate,
      endDate: endDate || null,
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
    startDate,
    patternDays,
  };
}

/**
 * Submits a schedule/shift change request on behalf of the active employee.
 */
export async function requestShiftChange(
  session: SessionContext,
  input: ShiftChangeRequestInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const employee = await resolveEmployee(session.employeeId || session.userId);
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND: Active employee profile required to request a schedule change.");
  }

  if (!input.requestedShiftId) {
    throw new Error("SHIFT_REQUIRED: Please select a requested shift.");
  }
  if (!input.effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) {
    throw new Error("INVALID_DATE: Effective date must be in YYYY-MM-DD format.");
  }
  if (input.endDate && input.endDate < input.effectiveDate) {
    throw new Error("INVALID_DATE_RANGE: End date cannot be earlier than effective date.");
  }
  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error("REASON_REQUIRED: Please provide a reason for the schedule change request.");
  }

  const targetShiftRows = await db
    .select()
    .from(shifts)
    .where(eq(shifts.id, input.requestedShiftId))
    .limit(1);

  if (targetShiftRows.length === 0) {
    throw new Error("SHIFT_NOT_FOUND: Requested shift does not exist.");
  }
  const targetShift = targetShiftRows[0];

  const currentShift = await getEmployeeShiftForDate(employee.id, input.effectiveDate);
  const patternDays =
    input.requestedPatternDays && input.requestedPatternDays.length > 0
      ? input.requestedPatternDays
      : ["MON", "TUE", "WED", "THU", "FRI"];

  const requestId = `scr_${randomUUID()}`;
  const now = Date.now();

  await db.insert(shiftChangeRequests).values({
    id: requestId,
    employeeId: employee.id,
    currentShiftId: currentShift?.shiftId || null,
    requestedShiftId: targetShift.id,
    effectiveDate: input.effectiveDate,
    endDate: input.endDate || null,
    requestedPatternDays: JSON.stringify(patternDays),
    reason: input.reason.trim(),
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
  });

  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "SHIFT_CHANGE_REQUESTED",
    targetEntity: "shift_change_requests",
    targetId: requestId,
    changes: {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      currentShiftId: currentShift?.shiftId || null,
      requestedShiftId: targetShift.id,
      requestedShiftName: targetShift.name,
      effectiveDate: input.effectiveDate,
      endDate: input.endDate || null,
      patternDays,
      reason: input.reason.trim(),
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  try {
    await notifyAdmins({
      title: `Shift Schedule Request (${employee.employeeCode})`,
      message: `${employee.employeeCode} requested ${targetShift.name} effective ${input.effectiveDate}.`,
      category: "SHIFT",
      actionUrl: "/admin/shifts",
      excludeUserId: session.userId,
    });
  } catch (err) {
    console.warn("Non-fatal notification dispatch failure:", err);
  }

  return {
    id: requestId,
    employeeId: employee.id,
    requestedShiftId: targetShift.id,
    requestedShiftName: targetShift.name,
    effectiveDate: input.effectiveDate,
    endDate: input.endDate || null,
    patternDays,
    status: "PENDING",
    reason: input.reason.trim(),
  };
}

/**
 * Lists schedule change requests according to caller scope.
 */
export async function getShiftChangeRequests(session: SessionContext) {
  const canManageAll =
    session.isSuperAdmin ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes("admin.shifts.manage") ||
    session.effectivePermissions.includes("dash.team_approvals.manage");

  const allShifts = await db.select().from(shifts);
  const shiftMap = new Map(allShifts.map((s) => [s.id, s]));

  const baseQuery = db
    .select({
      id: shiftChangeRequests.id,
      employeeId: shiftChangeRequests.employeeId,
      employeeCode: employees.employeeCode,
      employeeName: users.name,
      departmentId: employees.departmentId,
      teamId: employees.teamId,
      managerId: employees.managerId,
      currentShiftId: shiftChangeRequests.currentShiftId,
      requestedShiftId: shiftChangeRequests.requestedShiftId,
      effectiveDate: shiftChangeRequests.effectiveDate,
      endDate: shiftChangeRequests.endDate,
      requestedPatternDays: shiftChangeRequests.requestedPatternDays,
      reason: shiftChangeRequests.reason,
      status: shiftChangeRequests.status,
      rejectionReason: shiftChangeRequests.rejectionReason,
      reviewedAt: shiftChangeRequests.reviewedAt,
      createdAt: shiftChangeRequests.createdAt,
    })
    .from(shiftChangeRequests)
    .innerJoin(employees, eq(shiftChangeRequests.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .orderBy(desc(shiftChangeRequests.createdAt));

  let rows: any[];
  if (
    canManageAll &&
    (session.isSuperAdmin ||
      session.roles.includes("SUPER_ADMIN") ||
      session.widestScope === "ORGANIZATION")
  ) {
    rows = await baseQuery;
  } else if (canManageAll && session.widestScope === "DEPARTMENT") {
    rows = await baseQuery.where(inArray(employees.departmentId, session.managedDepartmentIds));
  } else if (canManageAll && session.widestScope === "TEAM") {
    rows = await baseQuery.where(inArray(employees.teamId, session.managedTeamIds));
  } else if (canManageAll && session.widestScope === "DIRECT_REPORTS") {
    rows = await baseQuery.where(
      or(
        inArray(employees.id, session.directReportIds),
        eq(employees.managerId, session.employeeId || "")
      )
    );
  } else {
    rows = await baseQuery.where(
      or(
        eq(shiftChangeRequests.employeeId, session.employeeId || ""),
        eq(employees.employeeCode, session.employeeId || "")
      )
    );
  }

  return rows.map((r) => {
    const curShift = r.currentShiftId ? shiftMap.get(r.currentShiftId) : null;
    const reqShift = shiftMap.get(r.requestedShiftId) || null;
    let patternDays: string[] = [];
    try {
      patternDays = JSON.parse(r.requestedPatternDays || "[]");
    } catch {
      patternDays = ["MON", "TUE", "WED", "THU", "FRI"];
    }
    return {
      ...r,
      patternDays,
      currentShiftName: curShift?.name || "Current Shift",
      currentShiftTimings: curShift ? `${curShift.startTime} - ${curShift.endTime}` : null,
      requestedShiftName: reqShift?.name || "Requested Shift",
      requestedShiftCode: reqShift?.code || "",
      requestedShiftTimings: reqShift ? `${reqShift.startTime} - ${reqShift.endTime}` : "",
    };
  });
}

/**
 * Approves or rejects a schedule change request.
 * On approval, automatically assigns the requested shift & working day pattern to the employee.
 */
export async function reviewShiftChangeRequest(
  session: SessionContext,
  requestId: string,
  input: { status: "APPROVED" | "REJECTED"; rejectionReason?: string },
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const canManage =
    session.isSuperAdmin ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes("admin.shifts.manage") ||
    session.effectivePermissions.includes("dash.team_approvals.manage");

  if (!canManage) {
    throw new Error("UNAUTHORIZED: Insufficient permissions to review schedule change requests.");
  }

  const rows = await db
    .select()
    .from(shiftChangeRequests)
    .where(eq(shiftChangeRequests.id, requestId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error("REQUEST_NOT_FOUND: Schedule change request not found.");
  }

  const reqRow = rows[0];
  if (reqRow.status !== "PENDING") {
    throw new Error(`ALREADY_REVIEWED: Request has already been ${reqRow.status.toLowerCase()}.`);
  }

  const employee = await resolveEmployee(reqRow.employeeId);
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND: Target employee record does not exist.");
  }

  await verifyHierarchyScopeAccess(session, employee);

  const now = Date.now();
  if (input.status === "APPROVED") {
    const targetShiftRows = await db
      .select()
      .from(shifts)
      .where(eq(shifts.id, reqRow.requestedShiftId))
      .limit(1);

    if (targetShiftRows.length === 0) {
      throw new Error("SHIFT_NOT_FOUND: Requested shift no longer exists.");
    }

    let patternDays: string[] = ["MON", "TUE", "WED", "THU", "FRI"];
    try {
      patternDays = JSON.parse(reqRow.requestedPatternDays || "[]");
    } catch {
      // keep default
    }

    await applyShiftAssignment(
      session.userId,
      session.employeeId,
      employee,
      targetShiftRows[0],
      reqRow.effectiveDate,
      reqRow.endDate,
      patternDays,
      `Approved schedule change request: ${reqRow.reason}`,
      meta
    );
  }

  await db
    .update(shiftChangeRequests)
    .set({
      status: input.status,
      reviewedByUserId: session.userId,
      reviewedAt: now,
      rejectionReason: input.status === "REJECTED" ? input.rejectionReason || "Declined by HR" : null,
      updatedAt: now,
    })
    .where(eq(shiftChangeRequests.id, reqRow.id));

  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "SHIFT_CHANGE_REVIEWED",
    targetEntity: "shift_change_requests",
    targetId: reqRow.id,
    changes: {
      employeeId: reqRow.employeeId,
      decision: input.status,
      rejectionReason: input.rejectionReason || null,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  try {
    const recipientUserId = await resolveUserIdForEmployee(reqRow.employeeId);
    if (recipientUserId) {
      await createNotification({
        recipientUserId,
        title: `Schedule Change Request ${input.status === "APPROVED" ? "Approved" : "Rejected"}`,
        message: `Your shift change request effective ${reqRow.effectiveDate} was ${input.status.toLowerCase()}.`,
        category: "SHIFT",
        actionUrl: "/dash/shifts",
      });
    }
  } catch (err) {
    console.warn("Non-fatal notification dispatch failure:", err);
  }

  return {
    id: reqRow.id,
    status: input.status,
    reviewedByUserId: session.userId,
  };
}

