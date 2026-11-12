import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { employees, users } from "../db/schema";
import { logAuditEvent } from "../audit/logger";

export type ProfileChangeField =
  | "NAME"
  | "PHONE"
  | "PERSONAL_EMAIL"
  | "EMERGENCY_CONTACT"
  | "DATE_OF_BIRTH"
  | "GENDER"
  | "BANK_DETAILS"
  | "OTHER";

export type ProfileChangeStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";

export interface ProfileChangeRequestRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeEmail: string;
  field: ProfileChangeField;
  fieldLabel: string;
  currentValue: string;
  requestedValue: string;
  emergencyPhone?: string;
  reason: string;
  status: ProfileChangeStatus;
  reviewComment?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export const PROFILE_FIELD_LABELS: Record<ProfileChangeField, string> = {
  NAME: "Full Name",
  PHONE: "Phone Number",
  PERSONAL_EMAIL: "Personal Email",
  EMERGENCY_CONTACT: "Emergency Contact",
  DATE_OF_BIRTH: "Date of Birth",
  GENDER: "Gender",
  BANK_DETAILS: "Bank / Tax Details",
  OTHER: "Other Profile Information",
};

const DATA_DIR = path.join(process.cwd(), "data");
const PROFILE_REQUESTS_FILE = path.join(DATA_DIR, "profile-change-requests.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getProfileChangeRequests(filterEmployeeId?: string): ProfileChangeRequestRecord[] {
  ensureDataDir();
  try {
    if (!fs.existsSync(PROFILE_REQUESTS_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(PROFILE_REQUESTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    const all: ProfileChangeRequestRecord[] = Array.isArray(parsed) ? parsed : [];
    const sorted = [...all].sort((a, b) => b.createdAt - a.createdAt);
    return filterEmployeeId ? sorted.filter((r) => r.employeeId === filterEmployeeId) : sorted;
  } catch {
    return [];
  }
}

function saveProfileChangeRequests(records: ProfileChangeRequestRecord[]) {
  ensureDataDir();
  const sorted = [...records].sort((a, b) => b.createdAt - a.createdAt);
  fs.writeFileSync(PROFILE_REQUESTS_FILE, JSON.stringify(sorted, null, 2), "utf-8");
}

export async function createProfileChangeRequest(input: {
  employeeId: string;
  actorUserId: string;
  field: ProfileChangeField;
  requestedValue: string;
  emergencyPhone?: string;
  reason: string;
}): Promise<ProfileChangeRequestRecord> {
  if (!Object.prototype.hasOwnProperty.call(PROFILE_FIELD_LABELS, input.field)) {
    throw new Error("INVALID_FIELD: Unsupported profile field selected.");
  }

  const trimmedValue = (input.requestedValue || "").trim();
  const trimmedPhone = (input.emergencyPhone || "").trim();
  const trimmedReason = (input.reason || "").trim();

  if (!trimmedValue) {
    throw new Error("VALUE_REQUIRED: Please enter the requested new value.");
  }
  if (input.field === "PERSONAL_EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
    throw new Error("INVALID_EMAIL: Please enter a valid personal email address.");
  }
  if (input.field === "DATE_OF_BIRTH" && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    throw new Error("INVALID_DATE: Date of birth must be in YYYY-MM-DD format.");
  }
  if (trimmedReason.length < 4) {
    throw new Error("REASON_REQUIRED: Please provide a brief reason for this change.");
  }

  const rows = await db
    .select({
      employeeId: employees.id,
      employeeCode: employees.employeeCode,
      name: users.name,
      email: users.email,
      phone: employees.phone,
      personalEmail: employees.personalEmail,
      dateOfBirth: employees.dateOfBirth,
      gender: employees.gender,
      emergencyContactName: employees.emergencyContactName,
      emergencyContactPhone: employees.emergencyContactPhone,
    })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .where(eq(employees.id, input.employeeId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error("EMPLOYEE_NOT_FOUND: Active employee record not found.");
  }

  const emp = rows[0];
  let currentValue = "Not set";
  switch (input.field) {
    case "NAME":
      currentValue = emp.name;
      break;
    case "PHONE":
      currentValue = emp.phone || "Not set";
      break;
    case "PERSONAL_EMAIL":
      currentValue = emp.personalEmail || "Not set";
      break;
    case "EMERGENCY_CONTACT":
      currentValue =
        emp.emergencyContactName || emp.emergencyContactPhone
          ? `${emp.emergencyContactName || "—"} (${emp.emergencyContactPhone || "—"})`
          : "Not set";
      break;
    case "DATE_OF_BIRTH":
      currentValue = emp.dateOfBirth || "Not set";
      break;
    case "GENDER":
      currentValue = emp.gender || "Not set";
      break;
    case "BANK_DETAILS":
      currentValue = "On File (Protected)";
      break;
    default:
      currentValue = "Current Record";
  }

  const now = Date.now();
  const displayRequested =
    input.field === "EMERGENCY_CONTACT" && trimmedPhone
      ? `${trimmedValue} (${trimmedPhone})`
      : trimmedValue;

  const record: ProfileChangeRequestRecord = {
    id: `pcr_${randomUUID()}`,
    employeeId: emp.employeeId,
    employeeCode: emp.employeeCode,
    employeeName: emp.name,
    employeeEmail: emp.email,
    field: input.field,
    fieldLabel: PROFILE_FIELD_LABELS[input.field],
    currentValue,
    requestedValue: displayRequested,
    emergencyPhone: input.field === "EMERGENCY_CONTACT" ? trimmedPhone || undefined : undefined,
    reason: trimmedReason,
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
  };

  const all = getProfileChangeRequests();
  all.unshift(record);
  saveProfileChangeRequests(all);

  await logAuditEvent({
    actorUserId: input.actorUserId,
    actorEmployeeId: emp.employeeId,
    action: "PROFILE_CHANGE_REQUESTED",
    targetEntity: "profile_change_requests",
    targetId: record.id,
    changes: {
      field: record.field,
      currentValue: record.currentValue,
      requestedValue: record.requestedValue,
    },
  });

  return record;
}

export async function transitionProfileChangeRequest(params: {
  requestId: string;
  action: "APPROVE" | "REJECT" | "WITHDRAW";
  actorUserId: string;
  actorName: string;
  isAdmin: boolean;
  actorEmployeeId?: string | null;
  reviewComment?: string;
}): Promise<ProfileChangeRequestRecord> {
  const all = getProfileChangeRequests();
  const idx = all.findIndex((r) => r.id === params.requestId);
  if (idx === -1) {
    throw new Error("NOT_FOUND: Profile change request not found.");
  }

  const current = all[idx];
  if (current.status !== "PENDING") {
    throw new Error(`INVALID_STATE: Only PENDING requests can be ${params.action.toLowerCase()}ed.`);
  }

  if (params.action === "WITHDRAW") {
    if (current.employeeId !== params.actorEmployeeId && !params.isAdmin) {
      throw new Error("FORBIDDEN: You can only withdraw your own request.");
    }
    const updated: ProfileChangeRequestRecord = {
      ...current,
      status: "WITHDRAWN",
      updatedAt: Date.now(),
    };
    all[idx] = updated;
    saveProfileChangeRequests(all);
    return updated;
  }

  if (!params.isAdmin) {
    throw new Error("FORBIDDEN: Only HR or Admin can review profile change requests.");
  }

  const now = Date.now();
  const nextStatus: ProfileChangeStatus = params.action === "APPROVE" ? "APPROVED" : "REJECTED";

  if (params.action === "APPROVE") {
    const empRows = await db
      .select({ id: employees.id, userId: employees.userId })
      .from(employees)
      .where(eq(employees.id, current.employeeId))
      .limit(1);

    if (empRows.length > 0) {
      const empRow = empRows[0];
      if (current.field === "NAME") {
        await db
          .update(users)
          .set({ name: current.requestedValue, updatedAt: now })
          .where(eq(users.id, empRow.userId));
      } else {
        const empPatch: Record<string, any> = {
          updatedAt: now,
          concurrencyVersion: sql`${employees.concurrencyVersion} + 1`,
        };
        if (current.field === "PHONE") empPatch.phone = current.requestedValue;
        else if (current.field === "PERSONAL_EMAIL") empPatch.personalEmail = current.requestedValue;
        else if (current.field === "DATE_OF_BIRTH") empPatch.dateOfBirth = current.requestedValue;
        else if (current.field === "GENDER") empPatch.gender = current.requestedValue;
        else if (current.field === "EMERGENCY_CONTACT") {
          const contactNameOnly = current.requestedValue.replace(/\s*\([^)]*\)\s*$/, "").trim();
          empPatch.emergencyContactName = contactNameOnly;
          if (current.emergencyPhone) {
            empPatch.emergencyContactPhone = current.emergencyPhone;
          }
        }

        if (Object.keys(empPatch).length > 2) {
          await db
            .update(employees)
            .set(empPatch)
            .where(eq(employees.id, empRow.id));
        }
      }
    }
  }

  const updated: ProfileChangeRequestRecord = {
    ...current,
    status: nextStatus,
    reviewComment: params.reviewComment?.trim() || undefined,
    reviewedByUserId: params.actorUserId,
    reviewedByName: params.actorName,
    reviewedAt: now,
    updatedAt: now,
  };

  all[idx] = updated;
  saveProfileChangeRequests(all);

  await logAuditEvent({
    actorUserId: params.actorUserId,
    actorEmployeeId: params.actorEmployeeId ?? undefined,
    action: `PROFILE_CHANGE_${nextStatus}`,
    targetEntity: "profile_change_requests",
    targetId: current.id,
    changes: {
      employeeId: current.employeeId,
      field: current.field,
      requestedValue: current.requestedValue,
      reviewComment: updated.reviewComment || null,
    },
  });

  return updated;
}

