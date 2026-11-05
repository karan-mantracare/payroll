import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import {
  departments,
  employeeStatusHistory,
  employees,
  locations,
  teams,
  users,
} from "../db/schema";
import { SessionContext } from "../permissions/types";
import { buildScopeCondition } from "../scope/filter";
import { logAuditEvent } from "../audit/logger";
import { generateNextEmployeeId, validateEmployeeId } from "./id-service";
import { randomUUID } from "node:crypto";

// Allowed enums
export const EmploymentTypeEnum = z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]);
export const EmploymentStatusEnum = z.enum(["ACTIVE", "ON_LEAVE", "PROBATION", "SUSPENDED", "TERMINATED"]);
export const ProbationStatusEnum = z.enum(["IN_PROBATION", "CONFIRMED", "EXTENDED", "WAIVED"]);

export const CreateEmployeeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Valid work email is required"),
  employeeCode: z.string().optional(),
  organizationId: z.string().default("org_mc_global"),
  departmentId: z.string().min(1, "Department is required"),
  locationId: z.string().min(1, "Location is required"),
  teamId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  jobTitle: z.string().min(1, "Job title / designation is required"),
  employmentType: EmploymentTypeEnum.default("FULL_TIME"),
  probationStatus: ProbationStatusEnum.default("CONFIRMED"),
  probationEndDate: z.string().optional().nullable(),
  joinedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Joining date must be in YYYY-MM-DD format"),
  status: EmploymentStatusEnum.default("ACTIVE"),
  phone: z.string().optional().nullable(),
  personalEmail: z.string().email("Invalid personal email").optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
});

export const UpdateEmployeeSchema = z.object({
  name: z.string().min(2).optional(),
  departmentId: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  teamId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  jobTitle: z.string().min(1).optional(),
  employmentType: EmploymentTypeEnum.optional(),
  probationStatus: ProbationStatusEnum.optional(),
  probationEndDate: z.string().optional().nullable(),
  joinedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  phone: z.string().optional().nullable(),
  personalEmail: z.string().email().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  concurrencyVersion: z.number().int().min(1, "Concurrency version is required for safe updates"),
});

export const StatusTransitionSchema = z.object({
  newStatus: EmploymentStatusEnum,
  reason: z.string().min(3, "Reason must be at least 3 characters"),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date must be YYYY-MM-DD"),
  concurrencyVersion: z.number().int().min(1, "Concurrency version is required"),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;
export type StatusTransitionInput = z.infer<typeof StatusTransitionSchema>;

export interface ListEmployeesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  departmentId?: string;
  teamId?: string;
  locationId?: string;
  status?: string;
  employmentType?: string;
  sortBy?: "name" | "employeeCode" | "joinedDate" | "status" | "jobTitle" | "createdAt";
  sortOrder?: "asc" | "desc";
}

/**
 * Lists employees with server-side filtering, searching, sorting, and pagination
 * strictly bound by the caller's data scope.
 */
export async function listEmployees(
  session: SessionContext,
  params: ListEmployeesParams = {}
) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 10));
  const offset = (page - 1) * pageSize;

  // Base scope conditions
  const scopeCondition = buildScopeCondition(session);
  const conditions = [];

  if (scopeCondition) {
    conditions.push(scopeCondition);
  }

  // Search filter (name, email, employeeCode, jobTitle)
  if (params.search?.trim()) {
    const s = `%${params.search.trim()}%`;
    conditions.push(
      or(
        like(users.name, s),
        like(users.email, s),
        like(employees.employeeCode, s),
        like(employees.jobTitle, s)
      )
    );
  }

  // Exact filters
  if (params.departmentId) conditions.push(eq(employees.departmentId, params.departmentId));
  if (params.teamId) conditions.push(eq(employees.teamId, params.teamId));
  if (params.locationId) conditions.push(eq(employees.locationId, params.locationId));
  if (params.status) conditions.push(eq(employees.status, params.status));
  if (params.employmentType) conditions.push(eq(employees.employmentType, params.employmentType));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Total count
  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .where(whereClause);

  const total = Number(countRes[0]?.count || 0);

  // Sorting
  const orderCol = (() => {
    switch (params.sortBy) {
      case "name":
        return users.name;
      case "employeeCode":
        return employees.employeeCode;
      case "joinedDate":
        return employees.joinedDate;
      case "status":
        return employees.status;
      case "jobTitle":
        return employees.jobTitle;
      default:
        return employees.createdAt;
    }
  })();

  const orderBy = params.sortOrder === "asc" ? asc(orderCol) : desc(orderCol);

  // Paginated query
  const records = await db
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      name: users.name,
      email: users.email,
      jobTitle: employees.jobTitle,
      departmentId: employees.departmentId,
      departmentName: departments.name,
      locationId: employees.locationId,
      locationName: locations.name,
      teamId: employees.teamId,
      teamName: teams.name,
      managerId: employees.managerId,
      employmentType: employees.employmentType,
      probationStatus: employees.probationStatus,
      status: employees.status,
      joinedDate: employees.joinedDate,
      concurrencyVersion: employees.concurrencyVersion,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
    })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(locations, eq(employees.locationId, locations.id))
    .leftJoin(teams, eq(employees.teamId, teams.id))
    .where(whereClause)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  return {
    employees: records,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Fetches single employee details by internal UUID or employeeCode.
 * Enforces server-side data scoping.
 */
export async function getEmployeeDetail(
  session: SessionContext,
  idOrCode: string
) {
  const scopeCondition = buildScopeCondition(session);
  const identifierCondition = or(eq(employees.id, idOrCode), eq(employees.employeeCode, idOrCode));

  const whereClause = scopeCondition ? and(identifierCondition, scopeCondition) : identifierCondition;

  const records = await db
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      userId: employees.userId,
      name: users.name,
      email: users.email,
      jobTitle: employees.jobTitle,
      organizationId: employees.organizationId,
      departmentId: employees.departmentId,
      departmentName: departments.name,
      locationId: employees.locationId,
      locationName: locations.name,
      teamId: employees.teamId,
      teamName: teams.name,
      managerId: employees.managerId,
      reportingHierarchy: employees.reportingHierarchy,
      employmentType: employees.employmentType,
      probationStatus: employees.probationStatus,
      probationEndDate: employees.probationEndDate,
      joinedDate: employees.joinedDate,
      status: employees.status,
      phone: employees.phone,
      personalEmail: employees.personalEmail,
      dateOfBirth: employees.dateOfBirth,
      gender: employees.gender,
      emergencyContactName: employees.emergencyContactName,
      emergencyContactPhone: employees.emergencyContactPhone,
      concurrencyVersion: employees.concurrencyVersion,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
    })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(locations, eq(employees.locationId, locations.id))
    .leftJoin(teams, eq(employees.teamId, teams.id))
    .where(whereClause)
    .limit(1);

  if (records.length === 0) {
    return null;
  }

  const emp = records[0];

  // Fetch manager details if exists
  let manager: { id: string; name: string; employeeCode: string; jobTitle: string } | null = null;
  if (emp.managerId) {
    const mgrRows = await db
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        name: users.name,
        jobTitle: employees.jobTitle,
      })
      .from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
      .where(or(eq(employees.id, emp.managerId), eq(employees.employeeCode, emp.managerId)))
      .limit(1);

    if (mgrRows.length > 0) {
      manager = mgrRows[0];
    }
  }

  // Fetch status history
  const statusHistory = await db
    .select({
      id: employeeStatusHistory.id,
      previousStatus: employeeStatusHistory.previousStatus,
      newStatus: employeeStatusHistory.newStatus,
      reason: employeeStatusHistory.reason,
      effectiveDate: employeeStatusHistory.effectiveDate,
      changedByUserId: employeeStatusHistory.changedByUserId,
      createdAt: employeeStatusHistory.createdAt,
    })
    .from(employeeStatusHistory)
    .where(eq(employeeStatusHistory.employeeId, emp.id))
    .orderBy(desc(employeeStatusHistory.createdAt));

  return {
    ...emp,
    manager,
    statusHistory,
  };
}

/**
 * Creates a new employee with internal UUID and configurable immutable employeeCode.
 * Requires admin privileges or employee.create permission.
 */
export async function createEmployee(
  session: SessionContext,
  rawInput: CreateEmployeeInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  if (
    !session.isSuperAdmin &&
    !session.roles.includes("ADMIN") &&
    !session.roles.includes("HR_MANAGER") &&
    !session.effectivePermissions.includes("employee.create")
  ) {
    throw new Error("Unauthorized: Insufficient permissions to create an employee.");
  }

  const input = CreateEmployeeSchema.parse(rawInput);

  // Determine Employee Code
  let finalEmployeeCode = input.employeeCode?.trim().toUpperCase();
  if (finalEmployeeCode) {
    const val = await validateEmployeeId(finalEmployeeCode);
    if (!val.valid) {
      throw new Error(`Invalid employee code: ${val.error}`);
    }
  } else {
    finalEmployeeCode = await generateNextEmployeeId(input.organizationId);
  }

  // Internal UUID as DB primary key
  const employeeUuid = `emp_${randomUUID()}`;
  const userUuid = `usr_${randomUUID()}`;
  const now = Date.now();

  await db.transaction(async (tx) => {
    // 1. Create User
    await tx.insert(users).values({
      id: userUuid,
      platformUserId: `plat_${randomUUID()}`,
      email: input.email.toLowerCase().trim(),
      name: input.name.trim(),
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });

    // 2. Create Employee
    await tx.insert(employees).values({
      id: employeeUuid,
      employeeCode: finalEmployeeCode!,
      userId: userUuid,
      organizationId: input.organizationId,
      departmentId: input.departmentId,
      locationId: input.locationId,
      teamId: input.teamId || null,
      managerId: input.managerId || null,
      reportingHierarchy: input.managerId ? JSON.stringify([input.managerId]) : "[]",
      jobTitle: input.jobTitle.trim(),
      employmentType: input.employmentType,
      probationStatus: input.probationStatus,
      probationEndDate: input.probationEndDate || null,
      joinedDate: input.joinedDate,
      status: input.status,
      phone: input.phone || null,
      personalEmail: input.personalEmail || null,
      dateOfBirth: input.dateOfBirth || null,
      gender: input.gender || null,
      emergencyContactName: input.emergencyContactName || null,
      emergencyContactPhone: input.emergencyContactPhone || null,
      concurrencyVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
  });

  // Audit record
  await logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "EMPLOYEE_CREATED",
    targetEntity: "employees",
    targetId: employeeUuid,
    changes: {
      employeeCode: finalEmployeeCode,
      name: input.name,
      email: input.email,
      jobTitle: input.jobTitle,
      departmentId: input.departmentId,
      locationId: input.locationId,
      status: input.status,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    id: employeeUuid,
    employeeCode: finalEmployeeCode,
    name: input.name,
    email: input.email,
  };
}

/**
 * Updates an employee's profile with optimistic locking.
 * Immutable fields (id, employeeCode) are protected against modifications.
 */
export async function updateEmployee(
  session: SessionContext,
  employeeId: string,
  rawInput: UpdateEmployeeInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  if (
    !session.isSuperAdmin &&
    !session.roles.includes("ADMIN") &&
    !session.roles.includes("HR_MANAGER") &&
    !session.effectivePermissions.includes("employee.edit")
  ) {
    throw new Error("Unauthorized: Insufficient permissions to edit employee details.");
  }

  const input = UpdateEmployeeSchema.parse(rawInput);

  // Fetch existing record
  const existingRows = await db
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      userId: employees.userId,
      concurrencyVersion: employees.concurrencyVersion,
      updatedAt: employees.updatedAt,
      name: users.name,
      jobTitle: employees.jobTitle,
      departmentId: employees.departmentId,
      locationId: employees.locationId,
      teamId: employees.teamId,
      managerId: employees.managerId,
      employmentType: employees.employmentType,
      probationStatus: employees.probationStatus,
    })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .where(or(eq(employees.id, employeeId), eq(employees.employeeCode, employeeId)))
    .limit(1);

  if (existingRows.length === 0) {
    throw new Error(`Employee "${employeeId}" not found.`);
  }

  const existing = existingRows[0];

  // Optimistic concurrency check
  if (existing.concurrencyVersion !== input.concurrencyVersion) {
    throw new Error(
      `CONCURRENCY_CONFLICT: The employee record was modified by another user. ` +
      `Expected version ${input.concurrencyVersion}, found version ${existing.concurrencyVersion}. Please refresh and retry.`
    );
  }

  const nextVersion = existing.concurrencyVersion + 1;
  const now = Math.max(Date.now(), existing.updatedAt + 1);

  await db.transaction(async (tx) => {
    // 1. Update user name if changed
    if (input.name && input.name !== existing.name) {
      await tx
        .update(users)
        .set({ name: input.name, updatedAt: now })
        .where(eq(users.id, existing.userId));
    }

    // 2. Update employee
    const res: any = await tx
      .update(employees)
      .set({
        departmentId: input.departmentId ?? existing.departmentId,
        locationId: input.locationId ?? existing.locationId,
        teamId: input.teamId !== undefined ? input.teamId : existing.teamId,
        managerId: input.managerId !== undefined ? input.managerId : existing.managerId,
        jobTitle: input.jobTitle ?? existing.jobTitle,
        employmentType: input.employmentType ?? existing.employmentType,
        probationStatus: input.probationStatus ?? existing.probationStatus,
        probationEndDate: input.probationEndDate,
        joinedDate: input.joinedDate,
        phone: input.phone,
        personalEmail: input.personalEmail,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
        concurrencyVersion: nextVersion,
        updatedAt: now,
      })
      .where(
        and(
          eq(employees.id, existing.id),
          eq(employees.concurrencyVersion, input.concurrencyVersion)
        )
      );

    if (res.rowsAffected === 0) {
      throw new Error("CONCURRENCY_CONFLICT: Simultaneous write detected during update. Aborted.");
    }
  });

  // Audit event
  await logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "EMPLOYEE_UPDATED",
    targetEntity: "employees",
    targetId: existing.id,
    changes: {
      jobTitle: { from: existing.jobTitle, to: input.jobTitle ?? existing.jobTitle },
      departmentId: { from: existing.departmentId, to: input.departmentId ?? existing.departmentId },
      managerId: { from: existing.managerId, to: input.managerId ?? existing.managerId },
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    id: existing.id,
    employeeCode: existing.employeeCode,
    concurrencyVersion: nextVersion,
  };
}

/**
 * Transitions an employee's employment status with reason, effective date, and audit trail.
 */
export async function transitionEmployeeStatus(
  session: SessionContext,
  employeeId: string,
  rawInput: StatusTransitionInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  if (
    !session.isSuperAdmin &&
    !session.roles.includes("ADMIN") &&
    !session.roles.includes("HR_MANAGER") &&
    !session.effectivePermissions.includes("employee.edit")
  ) {
    throw new Error("Unauthorized: Insufficient permissions to change employment status.");
  }

  const input = StatusTransitionSchema.parse(rawInput);

  const existingRows = await db
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      status: employees.status,
      concurrencyVersion: employees.concurrencyVersion,
      updatedAt: employees.updatedAt,
    })
    .from(employees)
    .where(or(eq(employees.id, employeeId), eq(employees.employeeCode, employeeId)))
    .limit(1);

  if (existingRows.length === 0) {
    throw new Error(`Employee "${employeeId}" not found.`);
  }

  const existing = existingRows[0];

  if (existing.status === input.newStatus) {
    throw new Error(`Employee is already in status "${input.newStatus}".`);
  }

  if (existing.concurrencyVersion !== input.concurrencyVersion) {
    throw new Error("CONCURRENCY_CONFLICT: Record has changed. Please refresh and retry.");
  }

  const nextVersion = existing.concurrencyVersion + 1;
  const now = Math.max(Date.now(), existing.updatedAt + 1);

  await db.transaction(async (tx) => {
    // 1. Update employee status
    const res: any = await tx
      .update(employees)
      .set({
        status: input.newStatus,
        concurrencyVersion: nextVersion,
        updatedAt: now,
      })
      .where(
        and(
          eq(employees.id, existing.id),
          eq(employees.concurrencyVersion, input.concurrencyVersion)
        )
      );

    if (res.rowsAffected === 0) {
      throw new Error("CONCURRENCY_CONFLICT: Status transition race condition detected. Aborted.");
    }

    // 2. Insert into employee_status_history
    await tx.insert(employeeStatusHistory).values({
      id: `stat_${randomUUID()}`,
      employeeId: existing.id,
      previousStatus: existing.status,
      newStatus: input.newStatus,
      reason: input.reason.trim(),
      effectiveDate: input.effectiveDate,
      changedByUserId: session.userId,
      createdAt: now,
    });
  });

  // 3. Record tamper-evident audit log
  await logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "EMPLOYEE_STATUS_TRANSITION",
    targetEntity: "employees",
    targetId: existing.id,
    changes: {
      previousStatus: existing.status,
      newStatus: input.newStatus,
      reason: input.reason,
      effectiveDate: input.effectiveDate,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    id: existing.id,
    employeeCode: existing.employeeCode,
    previousStatus: existing.status,
    newStatus: input.newStatus,
    concurrencyVersion: nextVersion,
  };
}

