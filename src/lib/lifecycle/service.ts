import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { departments, employees, locations, teams } from "../db/schema";
import { logAuditEvent } from "../audit/logger";

export type JmlRequestType = "MOVE" | "LEAVE";

export type JmlMoveCategory =
  | "DEPARTMENT_TRANSFER"
  | "LOCATION_RELOCATION"
  | "TEAM_CHANGE"
  | "ROLE_CHANGE";

export type JmlLeaveCategory =
  | "VOLUNTARY_RESIGNATION"
  | "END_OF_CONTRACT"
  | "RETIREMENT"
  | "PERSONAL_REASONS";

export type JmlRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";

export interface JmlMoveDetails {
  moveCategory: JmlMoveCategory;
  currentDepartmentId: string;
  currentDepartmentName: string;
  currentLocationId: string;
  currentLocationName: string;
  currentTeamId: string | null;
  currentTeamName: string | null;
  currentJobTitle: string;
  targetDepartmentId?: string | null;
  targetDepartmentName?: string | null;
  targetLocationId?: string | null;
  targetLocationName?: string | null;
  targetTeamId?: string | null;
  targetTeamName?: string | null;
  targetJobTitle?: string | null;
}

export interface JmlLeaveDetails {
  leaveCategory: JmlLeaveCategory;
  noticePeriodDays: number;
  handoverPlan?: string;
}

export interface JmlRequestRecord {
  id: string;
  requestType: JmlRequestType;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeEmail: string;
  effectiveDate: string; // For MOVE: preferred effective date; For LEAVE: proposed last working day (YYYY-MM-DD)
  reason: string;
  status: JmlRequestStatus;
  moveDetails?: JmlMoveDetails;
  leaveDetails?: JmlLeaveDetails;
  reviewComment?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface EmployeeJmlContext {
  employeeId: string;
  employeeCode: string;
  jobTitle: string;
  joinedDate: string;
  employmentType: string;
  status: string;
  departmentId: string;
  departmentName: string;
  locationId: string;
  locationName: string;
  teamId: string | null;
  teamName: string | null;
}

export interface JmlLookupOptions {
  departments: Array<{ id: string; name: string; code: string }>;
  locations: Array<{ id: string; name: string; city: string }>;
  teams: Array<{ id: string; name: string; departmentId: string }>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const JML_REQUESTS_FILE = path.join(DATA_DIR, "jml-requests.json");
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getJmlRequests(filterEmployeeId?: string): JmlRequestRecord[] {
  ensureDataDir();
  try {
    if (!fs.existsSync(JML_REQUESTS_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(JML_REQUESTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    const all: JmlRequestRecord[] = Array.isArray(parsed) ? parsed : [];
    const sorted = [...all].sort((a, b) => b.createdAt - a.createdAt);
    return filterEmployeeId
      ? sorted.filter((r) => r.employeeId === filterEmployeeId)
      : sorted;
  } catch {
    return [];
  }
}

function saveJmlRequests(records: JmlRequestRecord[]) {
  ensureDataDir();
  const sorted = [...records].sort((a, b) => b.createdAt - a.createdAt);
  fs.writeFileSync(JML_REQUESTS_FILE, JSON.stringify(sorted, null, 2), "utf-8");
}

export async function getJmlLookupOptions(): Promise<JmlLookupOptions> {
  const [deptRows, locRows, teamRows] = await Promise.all([
    db.select({ id: departments.id, name: departments.name, code: departments.code }).from(departments),
    db.select({ id: locations.id, name: locations.name, city: locations.city }).from(locations),
    db.select({ id: teams.id, name: teams.name, departmentId: teams.departmentId }).from(teams),
  ]);

  return {
    departments: deptRows,
    locations: locRows,
    teams: teamRows,
  };
}

export async function getEmployeeJmlContext(employeeId: string): Promise<EmployeeJmlContext | null> {
  const rows = await db
    .select({
      employeeId: employees.id,
      employeeCode: employees.employeeCode,
      jobTitle: employees.jobTitle,
      joinedDate: employees.joinedDate,
      employmentType: employees.employmentType,
      status: employees.status,
      departmentId: employees.departmentId,
      departmentName: departments.name,
      locationId: employees.locationId,
      locationName: locations.name,
      teamId: employees.teamId,
      teamName: teams.name,
    })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(locations, eq(employees.locationId, locations.id))
    .leftJoin(teams, eq(employees.teamId, teams.id))
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    employeeId: r.employeeId,
    employeeCode: r.employeeCode,
    jobTitle: r.jobTitle,
    joinedDate: r.joinedDate,
    employmentType: r.employmentType,
    status: r.status,
    departmentId: r.departmentId,
    departmentName: r.departmentName || r.departmentId,
    locationId: r.locationId,
    locationName: r.locationName || r.locationId,
    teamId: r.teamId ?? null,
    teamName: r.teamName ?? null,
  };
}

export function calculateNoticeDays(lastWorkingDate: string): number {
  const todayStr = new Date().toISOString().split("T")[0];
  const start = new Date(`${todayStr}T00:00:00Z`).getTime();
  const end = new Date(`${lastWorkingDate}T00:00:00Z`).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / (24 * 60 * 60 * 1000)));
}

export async function createJmlRequest(input: {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  actorUserId: string;
  requestType: JmlRequestType;
  effectiveDate: string;
  reason: string;
  moveCategory?: JmlMoveCategory;
  targetDepartmentId?: string | null;
  targetLocationId?: string | null;
  targetTeamId?: string | null;
  targetJobTitle?: string | null;
  leaveCategory?: JmlLeaveCategory;
  noticePeriodDays?: number;
  handoverPlan?: string;
}): Promise<JmlRequestRecord> {
  const profile = await getEmployeeJmlContext(input.employeeId);
  if (!profile) {
    throw new Error("EMPLOYEE_NOT_FOUND: Active employee profile is required to submit a JML request.");
  }

  if (!DATE_REGEX.test(input.effectiveDate || "")) {
    throw new Error("INVALID_DATE: Effective / last working date must be in YYYY-MM-DD format.");
  }

  const trimmedReason = (input.reason || "").trim();
  if (trimmedReason.length < 5) {
    throw new Error("REASON_REQUIRED: Please provide a detailed reason (at least 5 characters).");
  }

  const now = Date.now();
  const options = await getJmlLookupOptions();

  if (input.requestType === "MOVE") {
    const moveCategory: JmlMoveCategory = input.moveCategory || "DEPARTMENT_TRANSFER";
    const targetDeptId = input.targetDepartmentId?.trim() || null;
    const targetLocId = input.targetLocationId?.trim() || null;
    const targetTeamId = input.targetTeamId?.trim() || null;
    const targetTitle = input.targetJobTitle?.trim() || null;

    const deptObj = targetDeptId ? options.departments.find((d) => d.id === targetDeptId) : null;
    const locObj = targetLocId ? options.locations.find((l) => l.id === targetLocId) : null;
    const teamObj = targetTeamId ? options.teams.find((t) => t.id === targetTeamId) : null;

    const hasDeptChange = Boolean(deptObj && deptObj.id !== profile.departmentId);
    const hasLocChange = Boolean(locObj && locObj.id !== profile.locationId);
    const hasTeamChange = Boolean(teamObj && teamObj.id !== profile.teamId);
    const hasTitleChange = Boolean(targetTitle && targetTitle !== profile.jobTitle);

    if (!hasDeptChange && !hasLocChange && !hasTeamChange && !hasTitleChange) {
      throw new Error(
        "TARGET_CHANGE_REQUIRED: Select at least one new department, location, team, or role/designation different from your current assignment."
      );
    }

    const record: JmlRequestRecord = {
      id: `jml_${randomUUID()}`,
      requestType: "MOVE",
      employeeId: profile.employeeId,
      employeeCode: profile.employeeCode,
      employeeName: input.employeeName,
      employeeEmail: input.employeeEmail,
      effectiveDate: input.effectiveDate,
      reason: trimmedReason,
      status: "PENDING",
      moveDetails: {
        moveCategory,
        currentDepartmentId: profile.departmentId,
        currentDepartmentName: profile.departmentName,
        currentLocationId: profile.locationId,
        currentLocationName: profile.locationName,
        currentTeamId: profile.teamId,
        currentTeamName: profile.teamName,
        currentJobTitle: profile.jobTitle,
        targetDepartmentId: hasDeptChange ? deptObj!.id : null,
        targetDepartmentName: hasDeptChange ? deptObj!.name : null,
        targetLocationId: hasLocChange ? locObj!.id : null,
        targetLocationName: hasLocChange ? locObj!.name : null,
        targetTeamId: hasTeamChange ? teamObj!.id : null,
        targetTeamName: hasTeamChange ? teamObj!.name : null,
        targetJobTitle: hasTitleChange ? targetTitle : null,
      },
      createdAt: now,
      updatedAt: now,
    };

    const all = getJmlRequests();
    all.unshift(record);
    saveJmlRequests(all);

    await logAuditEvent({
      actorUserId: input.actorUserId,
      actorEmployeeId: profile.employeeId,
      action: "JML_MOVE_REQUESTED",
      targetEntity: "jml_requests",
      targetId: record.id,
      changes: {
        moveCategory,
        effectiveDate: record.effectiveDate,
        targetDepartmentName: record.moveDetails?.targetDepartmentName,
        targetLocationName: record.moveDetails?.targetLocationName,
        targetTeamName: record.moveDetails?.targetTeamName,
        targetJobTitle: record.moveDetails?.targetJobTitle,
      },
    });

    return record;
  }

  if (input.requestType === "LEAVE") {
    const leaveCategory: JmlLeaveCategory = input.leaveCategory || "VOLUNTARY_RESIGNATION";
    const noticeDays =
      typeof input.noticePeriodDays === "number" && input.noticePeriodDays >= 0
        ? Math.round(input.noticePeriodDays)
        : calculateNoticeDays(input.effectiveDate);

    const record: JmlRequestRecord = {
      id: `jml_${randomUUID()}`,
      requestType: "LEAVE",
      employeeId: profile.employeeId,
      employeeCode: profile.employeeCode,
      employeeName: input.employeeName,
      employeeEmail: input.employeeEmail,
      effectiveDate: input.effectiveDate,
      reason: trimmedReason,
      status: "PENDING",
      leaveDetails: {
        leaveCategory,
        noticePeriodDays: noticeDays,
        handoverPlan: input.handoverPlan?.trim() || undefined,
      },
      createdAt: now,
      updatedAt: now,
    };

    const all = getJmlRequests();
    all.unshift(record);
    saveJmlRequests(all);

    await logAuditEvent({
      actorUserId: input.actorUserId,
      actorEmployeeId: profile.employeeId,
      action: "JML_LEAVE_REQUESTED",
      targetEntity: "jml_requests",
      targetId: record.id,
      changes: {
        leaveCategory,
        lastWorkingDate: record.effectiveDate,
        noticePeriodDays: noticeDays,
      },
    });

    return record;
  }

  throw new Error("INVALID_REQUEST_TYPE: Request type must be MOVE or LEAVE.");
}

export async function transitionJmlRequest(params: {
  requestId: string;
  action: "APPROVE" | "REJECT" | "WITHDRAW";
  actorUserId: string;
  actorName: string;
  isAdmin: boolean;
  actorEmployeeId?: string | null;
  reviewComment?: string;
}): Promise<JmlRequestRecord> {
  const all = getJmlRequests();
  const idx = all.findIndex((r) => r.id === params.requestId);
  if (idx === -1) {
    throw new Error("NOT_FOUND: JML request not found.");
  }

  const current = all[idx];
  if (current.status !== "PENDING") {
    throw new Error(`INVALID_STATE: Only PENDING requests can be ${params.action.toLowerCase()}ed.`);
  }

  if (params.action === "WITHDRAW") {
    if (current.employeeId !== params.actorEmployeeId && !params.isAdmin) {
      throw new Error("FORBIDDEN: You can only withdraw your own request.");
    }
    const updated: JmlRequestRecord = {
      ...current,
      status: "WITHDRAWN",
      updatedAt: Date.now(),
    };
    all[idx] = updated;
    saveJmlRequests(all);
    return updated;
  }

  if (!params.isAdmin) {
    throw new Error("FORBIDDEN: Only HR or Admin can approve or reject lifecycle requests.");
  }

  const now = Date.now();
  const nextStatus: JmlRequestStatus = params.action === "APPROVE" ? "APPROVED" : "REJECTED";

  if (params.action === "APPROVE" && current.requestType === "MOVE" && current.moveDetails) {
    const updateFields: Record<string, any> = {
      updatedAt: now,
      concurrencyVersion: sql`${employees.concurrencyVersion} + 1`,
    };
    if (current.moveDetails.targetDepartmentId) {
      updateFields.departmentId = current.moveDetails.targetDepartmentId;
    }
    if (current.moveDetails.targetLocationId) {
      updateFields.locationId = current.moveDetails.targetLocationId;
    }
    if (current.moveDetails.targetTeamId) {
      updateFields.teamId = current.moveDetails.targetTeamId;
    }
    if (current.moveDetails.targetJobTitle) {
      updateFields.jobTitle = current.moveDetails.targetJobTitle;
    }

    await db
      .update(employees)
      .set(updateFields)
      .where(eq(employees.id, current.employeeId));
  }

  const updated: JmlRequestRecord = {
    ...current,
    status: nextStatus,
    reviewComment: params.reviewComment?.trim() || undefined,
    reviewedByUserId: params.actorUserId,
    reviewedByName: params.actorName,
    reviewedAt: now,
    updatedAt: now,
  };

  all[idx] = updated;
  saveJmlRequests(all);

  await logAuditEvent({
    actorUserId: params.actorUserId,
    actorEmployeeId: params.actorEmployeeId ?? undefined,
    action: `JML_${current.requestType}_${nextStatus}`,
    targetEntity: "jml_requests",
    targetId: current.id,
    changes: {
      employeeId: current.employeeId,
      employeeCode: current.employeeCode,
      effectiveDate: current.effectiveDate,
      reviewComment: updated.reviewComment || null,
    },
  });

  return updated;
}
