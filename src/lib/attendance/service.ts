import { db } from "../db/client";
import {
  attendanceRecords,
  attendanceEvents,
  attendanceCorrectionRequests,
  employees,
  users,
  departments,
  locations,
  teams,
  shifts,
} from "../db/schema";
import { eq, and, or, gte, lte, desc, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { SessionContext } from "../permissions/types";
import { auditLogger } from "../audit/logger";
import { resolveEmployee, verifyHierarchyScopeAccess } from "../hierarchy/service";
import { getEmployeeShiftForDate } from "../shifts/service";

export interface CheckInInput {
  timestampUtc?: string; // ISO 8601 UTC
  source?: "WEB" | "MOBILE" | "BIOMETRIC" | "MANUAL_ADJUSTMENT";
  ipAddress?: string;
  deviceInfo?: string;
  notes?: string;
}

export interface CheckOutInput {
  timestampUtc?: string;
  source?: "WEB" | "MOBILE" | "BIOMETRIC" | "MANUAL_ADJUSTMENT";
  ipAddress?: string;
  deviceInfo?: string;
  notes?: string;
}

export interface AttendanceCorrectionInput {
  date: string; // YYYY-MM-DD
  requestedCheckInUtc: string;
  requestedCheckOutUtc: string;
  reason: string;
}

export interface ManualAdjustmentInput {
  date: string;
  checkInTimeUtc: string;
  checkOutTimeUtc: string;
  status?: "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "ON_LEAVE";
  notes: string;
}

/**
 * Parses "HH:mm" time string to minutes from start of day.
 */
function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Converts a UTC ISO string to time of day minutes in UTC.
 */
function getUtcTimeMinutes(isoStr: string): number {
  const d = new Date(isoStr);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/**
 * Records an employee check-in event.
 * Enforces anti-duplicate check-in protection, records exact UTC timestamp,
 * calculates lateness against assigned shift rules, and logs tamper-evident audit.
 */
export async function recordCheckIn(
  session: SessionContext,
  employeeIdOrCode: string,
  input: CheckInInput = {},
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const employee = await resolveEmployee(employeeIdOrCode);
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND: Target employee record not found.");
  }

  // Verify permission: employee can self-check-in, or HR/Admin can check-in on behalf
  const isSelf = session.employeeId === employee.id || session.employeeId === employee.employeeCode;
  const canManage =
    session.isSuperAdmin ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes("admin.attendance.manage");

  if (!isSelf && !canManage) {
    throw new Error("UNAUTHORIZED: You do not have permission to record attendance for other employees.");
  }

  const timestamp = input.timestampUtc ? new Date(input.timestampUtc) : new Date();
  const dateStr = timestamp.toISOString().split("T")[0]; // YYYY-MM-DD
  const timestampUtc = timestamp.toISOString();
  const now = Date.now();

  // 1. Anti-Duplicate Check-in Protection
  const existingRecords = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, employee.id),
        eq(attendanceRecords.date, dateStr)
      )
    )
    .limit(1);

  if (existingRecords.length > 0 && existingRecords[0].checkInTimeUtc) {
    // If already checked in and no checkout has occurred, prevent duplicate
    if (!existingRecords[0].checkOutTimeUtc) {
      throw new Error(
        `ALREADY_CHECKED_IN: Employee is already checked in for ${dateStr} at ${existingRecords[0].checkInTimeUtc}. Please check out first.`
      );
    }
  }

  // 2. Resolve Applicable Shift & Lateness Calculation
  const shift = await getEmployeeShiftForDate(employee.id, dateStr);
  let status = "PRESENT";
  let lateMinutes = 0;

  if (shift) {
    const shiftStartMinutes = parseTimeToMinutes(shift.startTime);
    const checkInMinutes = getUtcTimeMinutes(timestampUtc);
    const gracePeriod = 15; // 15 minutes grace window

    if (checkInMinutes > shiftStartMinutes + gracePeriod) {
      lateMinutes = checkInMinutes - (shiftStartMinutes + gracePeriod);
      status = "LATE";
    }
  }

  const recordId = existingRecords.length > 0 ? existingRecords[0].id : `att_${randomUUID()}`;

  if (existingRecords.length > 0) {
    await db
      .update(attendanceRecords)
      .set({
        checkInTimeUtc: timestampUtc,
        shiftId: shift?.shiftId || null,
        status,
        lateMinutes,
        source: input.source || "WEB",
        notes: input.notes || existingRecords[0].notes,
        updatedAt: now,
      })
      .where(eq(attendanceRecords.id, recordId));
  } else {
    await db.insert(attendanceRecords).values({
      id: recordId,
      employeeId: employee.id,
      date: dateStr,
      shiftId: shift?.shiftId || null,
      checkInTimeUtc: timestampUtc,
      checkOutTimeUtc: null,
      totalWorkMinutes: 0,
      status,
      lateMinutes,
      earlyExitMinutes: 0,
      source: input.source || "WEB",
      notes: input.notes || null,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 3. Insert chronological raw event into audit stream
  await db.insert(attendanceEvents).values({
    id: `ev_${randomUUID()}`,
    attendanceRecordId: recordId,
    employeeId: employee.id,
    eventType: "CHECK_IN",
    timestampUtc,
    source: input.source || "WEB",
    ipAddress: input.ipAddress || meta?.ipAddress || null,
    deviceInfo: input.deviceInfo || meta?.userAgent || null,
    createdAt: now,
  });

  // 4. Append tamper-evident audit record
  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "ATTENDANCE_CHECK_IN",
    targetEntity: "attendance_records",
    targetId: recordId,
    changes: {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      date: dateStr,
      checkInTimeUtc: timestampUtc,
      shiftCode: shift?.shiftCode,
      status,
      lateMinutes,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    recordId,
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    date: dateStr,
    checkInTimeUtc: timestampUtc,
    status,
    lateMinutes,
    shift: shift ? { name: shift.shiftName, code: shift.shiftCode, startTime: shift.startTime } : null,
  };
}

/**
 * Records an employee check-out event.
 * Validates active check-in, computes total worked minutes and early exit penalties,
 * updates attendance record status, and creates raw event + durable audit log.
 */
export async function recordCheckOut(
  session: SessionContext,
  employeeIdOrCode: string,
  input: CheckOutInput = {},
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const employee = await resolveEmployee(employeeIdOrCode);
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND: Target employee record not found.");
  }

  const isSelf = session.employeeId === employee.id || session.employeeId === employee.employeeCode;
  const canManage =
    session.isSuperAdmin ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes("admin.attendance.manage");

  if (!isSelf && !canManage) {
    throw new Error("UNAUTHORIZED: You do not have permission to record attendance for other employees.");
  }

  const timestamp = input.timestampUtc ? new Date(input.timestampUtc) : new Date();
  const dateStr = timestamp.toISOString().split("T")[0];
  const timestampUtc = timestamp.toISOString();
  const now = Date.now();

  // Find today's active check-in
  const records = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, employee.id),
        eq(attendanceRecords.date, dateStr)
      )
    )
    .limit(1);

  if (records.length === 0 || !records[0].checkInTimeUtc) {
    throw new Error(`CHECK_IN_REQUIRED: No active check-in found for employee on ${dateStr}. Please check in first.`);
  }

  const record = records[0];
  const checkInDate = new Date(record.checkInTimeUtc!);
  const checkOutDate = timestamp;

  if (checkOutDate.getTime() < checkInDate.getTime()) {
    throw new Error("INVALID_TIMESTAMP: Check-out time cannot be earlier than check-in time.");
  }

  // Calculate gross worked minutes
  const totalDurationMinutes = Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60));

  // Subtract standard break duration from applicable shift
  const shift = await getEmployeeShiftForDate(employee.id, dateStr);
  const breakMinutes = shift?.breakDurationMinutes ?? 60;
  const netWorkMinutes = Math.max(0, totalDurationMinutes - (totalDurationMinutes > 300 ? breakMinutes : 0));

  // Determine early exit
  let earlyExitMinutes = 0;
  if (shift) {
    const shiftEndMinutes = parseTimeToMinutes(shift.endTime);
    const checkOutMinutes = getUtcTimeMinutes(timestampUtc);
    if (checkOutMinutes < shiftEndMinutes) {
      earlyExitMinutes = shiftEndMinutes - checkOutMinutes;
    }
  }

  // Determine final daily status
  let finalStatus = record.status;
  if (netWorkMinutes < 240) {
    // Under 4 hours is considered Half Day
    finalStatus = "HALF_DAY";
  } else if (record.lateMinutes > 0) {
    finalStatus = "LATE";
  } else {
    finalStatus = "PRESENT";
  }

  await db
    .update(attendanceRecords)
    .set({
      checkOutTimeUtc: timestampUtc,
      totalWorkMinutes: netWorkMinutes,
      status: finalStatus,
      earlyExitMinutes,
      source: input.source || "WEB",
      notes: input.notes || record.notes,
      updatedAt: now,
    })
    .where(eq(attendanceRecords.id, record.id));

  // Raw event
  await db.insert(attendanceEvents).values({
    id: `ev_${randomUUID()}`,
    attendanceRecordId: record.id,
    employeeId: employee.id,
    eventType: "CHECK_OUT",
    timestampUtc,
    source: input.source || "WEB",
    ipAddress: input.ipAddress || meta?.ipAddress || null,
    deviceInfo: input.deviceInfo || meta?.userAgent || null,
    createdAt: now,
  });

  // Audit log
  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "ATTENDANCE_CHECK_OUT",
    targetEntity: "attendance_records",
    targetId: record.id,
    changes: {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      date: dateStr,
      checkInTimeUtc: record.checkInTimeUtc,
      checkOutTimeUtc: timestampUtc,
      totalWorkMinutes: netWorkMinutes,
      status: finalStatus,
      earlyExitMinutes,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    recordId: record.id,
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    date: dateStr,
    checkInTimeUtc: record.checkInTimeUtc,
    checkOutTimeUtc: timestampUtc,
    totalWorkMinutes: netWorkMinutes,
    status: finalStatus,
    earlyExitMinutes,
  };
}

/**
 * Returns daily attendance records filtered by scope, date range, department, and status.
 */
export async function getAttendanceRecords(
  session: SessionContext,
  filters: {
    date?: string;
    startDate?: string;
    endDate?: string;
    departmentId?: string;
    status?: string;
    employeeId?: string;
  } = {}
) {
  const conditions: any[] = [];

  if (filters.date) {
    conditions.push(eq(attendanceRecords.date, filters.date));
  }
  if (filters.startDate) {
    conditions.push(gte(attendanceRecords.date, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(attendanceRecords.date, filters.endDate));
  }
  if (filters.status) {
    conditions.push(eq(attendanceRecords.status, filters.status));
  }

  // Scope enforcement
  if (session.isSuperAdmin || session.roles.includes("SUPER_ADMIN") || session.widestScope === "ORGANIZATION") {
    // Organization-wide access
  } else if (session.widestScope === "DEPARTMENT") {
    conditions.push(inArray(employees.departmentId, session.managedDepartmentIds));
  } else if (session.widestScope === "TEAM") {
    conditions.push(inArray(employees.teamId, session.managedTeamIds));
  } else if (session.widestScope === "DIRECT_REPORTS") {
    conditions.push(
      or(
        inArray(employees.id, session.directReportIds),
        eq(employees.managerId, session.employeeId || "")
      )
    );
  } else {
    // SELF scope
    conditions.push(
      or(
        eq(employees.id, session.employeeId || ""),
        eq(employees.employeeCode, session.employeeId || "")
      )
    );
  }

  if (filters.employeeId) {
    conditions.push(
      or(
        eq(attendanceRecords.employeeId, filters.employeeId),
        eq(employees.employeeCode, filters.employeeId)
      )
    );
  }

  if (filters.departmentId) {
    conditions.push(eq(employees.departmentId, filters.departmentId));
  }

  const query = db
    .select({
      id: attendanceRecords.id,
      employeeId: attendanceRecords.employeeId,
      employeeCode: employees.employeeCode,
      employeeName: users.name,
      employeeEmail: users.email,
      departmentName: departments.name,
      locationName: locations.name,
      jobTitle: employees.jobTitle,
      date: attendanceRecords.date,
      shiftId: attendanceRecords.shiftId,
      shiftName: shifts.name,
      shiftCode: shifts.code,
      shiftStartTime: shifts.startTime,
      shiftEndTime: shifts.endTime,
      checkInTimeUtc: attendanceRecords.checkInTimeUtc,
      checkOutTimeUtc: attendanceRecords.checkOutTimeUtc,
      totalWorkMinutes: attendanceRecords.totalWorkMinutes,
      status: attendanceRecords.status,
      lateMinutes: attendanceRecords.lateMinutes,
      earlyExitMinutes: attendanceRecords.earlyExitMinutes,
      source: attendanceRecords.source,
      notes: attendanceRecords.notes,
      updatedAt: attendanceRecords.updatedAt,
    })
    .from(attendanceRecords)
    .innerJoin(employees, eq(attendanceRecords.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(locations, eq(employees.locationId, locations.id))
    .leftJoin(shifts, eq(attendanceRecords.shiftId, shifts.id))
    .orderBy(desc(attendanceRecords.date), desc(attendanceRecords.createdAt));

  if (conditions.length > 0) {
    return await query.where(and(...conditions));
  }

  return await query;
}

/**
 * Returns today's active attendance status and assigned shift for an employee.
 */
export async function getTodayAttendanceStatus(session: SessionContext, employeeIdOrCode?: string) {
  const targetId = employeeIdOrCode || session.employeeId;
  if (!targetId) return null;
  const employee = await resolveEmployee(targetId);
  if (!employee) return null;

  const todayStr = new Date().toISOString().split("T")[0];
  const shift = await getEmployeeShiftForDate(employee.id, todayStr);

  const records = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, employee.id),
        eq(attendanceRecords.date, todayStr)
      )
    )
    .limit(1);

  const record = records.length > 0 ? records[0] : null;

  return {
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    employeeName: employee.name,
    today: todayStr,
    isCheckedIn: Boolean(record?.checkInTimeUtc && !record?.checkOutTimeUtc),
    isCheckedOut: Boolean(record?.checkOutTimeUtc),
    checkInTimeUtc: record?.checkInTimeUtc || null,
    checkOutTimeUtc: record?.checkOutTimeUtc || null,
    status: record?.status || (shift?.isWorkingDay ? "ABSENT" : "REST_DAY"),
    totalWorkMinutes: record?.totalWorkMinutes || 0,
    lateMinutes: record?.lateMinutes || 0,
    earlyExitMinutes: record?.earlyExitMinutes || 0,
    shift,
  };
}

/**
 * Submits an attendance correction/regularization request by employee.
 */
export async function requestAttendanceCorrection(
  session: SessionContext,
  input: AttendanceCorrectionInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const employee = await resolveEmployee(session.employeeId || session.userId);
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND: Active employee profile required to submit corrections.");
  }

  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error("REASON_REQUIRED: A valid reason is required for attendance correction.");
  }

  const existingRecords = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, employee.id),
        eq(attendanceRecords.date, input.date)
      )
    )
    .limit(1);

  const recordId = existingRecords.length > 0 ? existingRecords[0].id : null;
  const requestId = `cr_${randomUUID()}`;
  const now = Date.now();

  await db.insert(attendanceCorrectionRequests).values({
    id: requestId,
    employeeId: employee.id,
    attendanceRecordId: recordId,
    requestedDate: input.date,
    requestedCheckInUtc: input.requestedCheckInUtc,
    requestedCheckOutUtc: input.requestedCheckOutUtc,
    reason: input.reason.trim(),
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
  });

  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "ATTENDANCE_CORRECTION_REQUESTED",
    targetEntity: "attendance_correction_requests",
    targetId: requestId,
    changes: {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      date: input.date,
      requestedCheckInUtc: input.requestedCheckInUtc,
      requestedCheckOutUtc: input.requestedCheckOutUtc,
      reason: input.reason.trim(),
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    id: requestId,
    employeeId: employee.id,
    date: input.date,
    status: "PENDING",
    reason: input.reason,
  };
}

/**
 * Reviews (approves/rejects) an attendance correction request.
 * Approved requests directly regularize the attendance record with source MANUAL_ADJUSTMENT.
 */
export async function reviewAttendanceCorrection(
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
    session.effectivePermissions.includes("admin.attendance.manage");

  if (!canManage) {
    throw new Error("UNAUTHORIZED: Insufficient permissions to review attendance corrections.");
  }

  const requests = await db
    .select()
    .from(attendanceCorrectionRequests)
    .where(eq(attendanceCorrectionRequests.id, requestId))
    .limit(1);

  if (requests.length === 0) {
    throw new Error("REQUEST_NOT_FOUND: Attendance correction request not found.");
  }

  const req = requests[0];
  const now = Date.now();

  if (input.status === "APPROVED") {
    const checkInDate = new Date(req.requestedCheckInUtc);
    const checkOutDate = new Date(req.requestedCheckOutUtc);
    const totalDurationMinutes = Math.max(0, Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / 60000));
    const netWorkMinutes = Math.max(0, totalDurationMinutes > 300 ? totalDurationMinutes - 60 : totalDurationMinutes);

    const shift = await getEmployeeShiftForDate(req.employeeId, req.requestedDate);
    let finalStatus = netWorkMinutes >= 240 ? "PRESENT" : "HALF_DAY";

    if (req.attendanceRecordId) {
      await db
        .update(attendanceRecords)
        .set({
          checkInTimeUtc: req.requestedCheckInUtc,
          checkOutTimeUtc: req.requestedCheckOutUtc,
          totalWorkMinutes: netWorkMinutes,
          status: finalStatus,
          source: "MANUAL_ADJUSTMENT",
          notes: `Regularized via correction approval: ${req.reason}`,
          updatedAt: now,
        })
        .where(eq(attendanceRecords.id, req.attendanceRecordId));
    } else {
      const newRecId = `att_${randomUUID()}`;
      await db.insert(attendanceRecords).values({
        id: newRecId,
        employeeId: req.employeeId,
        date: req.requestedDate,
        shiftId: shift?.shiftId || null,
        checkInTimeUtc: req.requestedCheckInUtc,
        checkOutTimeUtc: req.requestedCheckOutUtc,
        totalWorkMinutes: netWorkMinutes,
        status: finalStatus,
        lateMinutes: 0,
        earlyExitMinutes: 0,
        source: "MANUAL_ADJUSTMENT",
        notes: `Regularized via correction approval: ${req.reason}`,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  await db
    .update(attendanceCorrectionRequests)
    .set({
      status: input.status,
      reviewedByUserId: session.userId,
      reviewedAt: now,
      rejectionReason: input.status === "REJECTED" ? input.rejectionReason : null,
      updatedAt: now,
    })
    .where(eq(attendanceCorrectionRequests.id, req.id));

  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "ATTENDANCE_CORRECTION_REVIEWED",
    targetEntity: "attendance_correction_requests",
    targetId: req.id,
    changes: {
      requestId: req.id,
      employeeId: req.employeeId,
      decision: input.status,
      rejectionReason: input.rejectionReason || null,
      reviewedAt: now,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    id: req.id,
    status: input.status,
    reviewedByUserId: session.userId,
  };
}

/**
 * Performs a direct manual attendance adjustment by HR/Admin.
 */
export async function manualAttendanceAdjustment(
  session: SessionContext,
  employeeIdOrCode: string,
  input: ManualAdjustmentInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const canManage =
    session.isSuperAdmin ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes("admin.attendance.manage");

  if (!canManage) {
    throw new Error("UNAUTHORIZED: Insufficient permissions to perform manual attendance adjustments.");
  }

  const employee = await resolveEmployee(employeeIdOrCode);
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND: Target employee record not found.");
  }

  await verifyHierarchyScopeAccess(session, employee);

  const checkInDate = new Date(input.checkInTimeUtc);
  const checkOutDate = new Date(input.checkOutTimeUtc);
  const totalDurationMinutes = Math.max(0, Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / 60000));
  const netWorkMinutes = Math.max(0, totalDurationMinutes > 300 ? totalDurationMinutes - 60 : totalDurationMinutes);

  const shift = await getEmployeeShiftForDate(employee.id, input.date);
  const finalStatus = input.status || (netWorkMinutes >= 240 ? "PRESENT" : "HALF_DAY");
  const now = Date.now();

  const existing = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, employee.id),
        eq(attendanceRecords.date, input.date)
      )
    )
    .limit(1);

  let recordId: string;
  if (existing.length > 0) {
    recordId = existing[0].id;
    await db
      .update(attendanceRecords)
      .set({
        checkInTimeUtc: input.checkInTimeUtc,
        checkOutTimeUtc: input.checkOutTimeUtc,
        totalWorkMinutes: netWorkMinutes,
        status: finalStatus,
        source: "MANUAL_ADJUSTMENT",
        notes: input.notes,
        updatedAt: now,
      })
      .where(eq(attendanceRecords.id, recordId));
  } else {
    recordId = `att_${randomUUID()}`;
    await db.insert(attendanceRecords).values({
      id: recordId,
      employeeId: employee.id,
      date: input.date,
      shiftId: shift?.shiftId || null,
      checkInTimeUtc: input.checkInTimeUtc,
      checkOutTimeUtc: input.checkOutTimeUtc,
      totalWorkMinutes: netWorkMinutes,
      status: finalStatus,
      lateMinutes: 0,
      earlyExitMinutes: 0,
      source: "MANUAL_ADJUSTMENT",
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    });
  }

  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "ATTENDANCE_MANUAL_ADJUSTED",
    targetEntity: "attendance_records",
    targetId: recordId,
    changes: {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      date: input.date,
      checkInTimeUtc: input.checkInTimeUtc,
      checkOutTimeUtc: input.checkOutTimeUtc,
      status: finalStatus,
      notes: input.notes,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    recordId,
    employeeId: employee.id,
    date: input.date,
    status: finalStatus,
    totalWorkMinutes: netWorkMinutes,
  };
}

export interface AttendanceImportRow {
  employeeCode: string;
  date: string; // YYYY-MM-DD
  checkInTime: string; // "09:00" or ISO 8601 UTC
  checkOutTime?: string; // "18:00" or ISO 8601 UTC
  status?: "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "ON_LEAVE";
  notes?: string;
}

export interface AttendanceImportResult {
  totalProcessed: number;
  importedCount: number;
  failedCount: number;
  errors: Array<{ rowNumber: number; employeeCode: string; error: string }>;
}

/**
 * Monthly attendance batch import engine.
 * Validates date formats, maps employee codes, calculates working hours & overnight durations,
 * detects duplicates, records events, and logs tamper-evident audit trails.
 */
export async function importMonthlyAttendance(
  session: SessionContext,
  rows: AttendanceImportRow[],
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<AttendanceImportResult> {
  const canManage =
    session.isSuperAdmin ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes("admin.attendance.manage");

  if (!canManage) {
    throw new Error("UNAUTHORIZED: Insufficient permissions to import attendance records.");
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("INVALID_PAYLOAD: Attendance import rows array is empty.");
  }

  const errors: Array<{ rowNumber: number; employeeCode: string; error: string }> = [];
  let importedCount = 0;
  const now = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;
    const cleanCode = row.employeeCode?.trim();

    if (!cleanCode) {
      errors.push({ rowNumber, employeeCode: "UNKNOWN", error: "Missing employee code." });
      continue;
    }

    if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      errors.push({ rowNumber, employeeCode: cleanCode, error: `Invalid date format '${row.date}'. Expected YYYY-MM-DD.` });
      continue;
    }

    if (!row.checkInTime) {
      errors.push({ rowNumber, employeeCode: cleanCode, error: "Missing check-in time." });
      continue;
    }

    // Resolve Employee Code
    const employee = await resolveEmployee(cleanCode);
    if (!employee) {
      errors.push({ rowNumber, employeeCode: cleanCode, error: `No employee found with code '${cleanCode}'.` });
      continue;
    }

    try {
      // Normalize Check-in and Check-out UTC strings
      let checkInUtc: string;
      if (row.checkInTime.includes("T")) {
        checkInUtc = new Date(row.checkInTime).toISOString();
      } else if (/^([01]\d|2[0-3]):[0-5]\d$/.test(row.checkInTime)) {
        checkInUtc = `${row.date}T${row.checkInTime}:00.000Z`;
      } else {
        errors.push({ rowNumber, employeeCode: cleanCode, error: `Invalid check-in time format '${row.checkInTime}'.` });
        continue;
      }

      let checkOutUtc: string | null = null;
      let totalWorkMinutes = 0;

      if (row.checkOutTime) {
        if (row.checkOutTime.includes("T")) {
          checkOutUtc = new Date(row.checkOutTime).toISOString();
        } else if (/^([01]\d|2[0-3]):[0-5]\d$/.test(row.checkOutTime)) {
          // Check for overnight shift (checkout time numerically before checkin time)
          const inMins = parseTimeToMinutes(row.checkInTime);
          const outMins = parseTimeToMinutes(row.checkOutTime);
          if (outMins < inMins) {
            // Next day overnight
            const nextDayDate = new Date(Date.parse(row.date) + 86400000).toISOString().split("T")[0];
            checkOutUtc = `${nextDayDate}T${row.checkOutTime}:00.000Z`;
          } else {
            checkOutUtc = `${row.date}T${row.checkOutTime}:00.000Z`;
          }
        }

        if (checkOutUtc) {
          const inMs = new Date(checkInUtc).getTime();
          const outMs = new Date(checkOutUtc).getTime();
          if (outMs > inMs) {
            totalWorkMinutes = Math.floor((outMs - inMs) / (60 * 1000));
          }
        }
      }

      // Shift lateness rule
      const shift = await getEmployeeShiftForDate(employee.id, row.date);
      let lateMinutes = 0;
      let status: "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "ON_LEAVE" = row.status || "PRESENT";

      if (shift && "startTime" in shift && shift.startTime) {
        const shiftStartMins = parseTimeToMinutes(shift.startTime);
        const checkInMins = getUtcTimeMinutes(checkInUtc);
        const graceMins = 15;
        if (checkInMins > shiftStartMins + graceMins) {
          lateMinutes = checkInMins - shiftStartMins;
          if (!row.status) status = "LATE";
        }
      }

      if (totalWorkMinutes > 0 && totalWorkMinutes < 240 && !row.status) {
        status = "HALF_DAY";
      }

      // Check for existing duplicate record for same date
      const existingRecords = await db
        .select()
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.employeeId, employee.id), eq(attendanceRecords.date, row.date)))
        .limit(1);

      let recordId: string;
      if (existingRecords.length > 0) {
        recordId = existingRecords[0].id;
        await db
          .update(attendanceRecords)
          .set({
            checkInTimeUtc: checkInUtc,
            checkOutTimeUtc: checkOutUtc,
            totalWorkMinutes,
            lateMinutes,
            status,
            source: "MANUAL_ADJUSTMENT",
            notes: row.notes || "Imported via CSV/Excel batch",
            updatedAt: now,
          })
          .where(eq(attendanceRecords.id, recordId));
      } else {
        recordId = `att_${randomUUID()}`;
        await db.insert(attendanceRecords).values({
          id: recordId,
          employeeId: employee.id,
          date: row.date,
          shiftId: shift?.shiftId || null,
          checkInTimeUtc: checkInUtc,
          checkOutTimeUtc: checkOutUtc,
          totalWorkMinutes,
          lateMinutes,
          earlyExitMinutes: 0,
          status,
          source: "MANUAL_ADJUSTMENT",
          notes: row.notes || "Imported via CSV/Excel batch",
          createdAt: now,
          updatedAt: now,
        });
      }

      // Insert event
      await db.insert(attendanceEvents).values({
        id: `evt_${randomUUID()}`,
        attendanceRecordId: recordId,
        employeeId: employee.id,
        eventType: "CHECK_IN",
        timestampUtc: checkInUtc,
        source: "MANUAL_ADJUSTMENT",
        createdAt: now,
      });

      importedCount++;
    } catch (rowErr: any) {
      errors.push({ rowNumber, employeeCode: cleanCode, error: rowErr?.message || "Failed to process record." });
    }
  }

  // Tamper-evident Audit log
  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "ATTENDANCE_MONTHLY_IMPORTED",
    targetEntity: "attendance_records",
    targetId: `import_${now}`,
    changes: {
      totalRows: rows.length,
      importedCount,
      failedCount: errors.length,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    totalProcessed: rows.length,
    importedCount,
    failedCount: errors.length,
    errors,
  };
}
