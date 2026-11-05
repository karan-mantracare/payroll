import { describe, it, expect, beforeEach } from "vitest";
import { seedDatabase } from "../src/lib/db/seed";
import { db } from "../src/lib/db/client";
import {
  attendanceRecords,
  attendanceEvents,
  attendanceCorrectionRequests,
  auditLogs,
} from "../src/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  recordCheckIn,
  recordCheckOut,
  getAttendanceRecords,
  getTodayAttendanceStatus,
  requestAttendanceCorrection,
  reviewAttendanceCorrection,
  manualAttendanceAdjustment,
} from "../src/lib/attendance/service";
import { SessionContext } from "../src/lib/permissions/types";

describe("Phase 3 — Attendance Engine & Time Tracking", () => {
  const adminSession: SessionContext = {
    userId: "usr_admin",
    employeeId: "EMP-002",
    name: "Aakash Admin",
    email: "admin@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["ADMIN"],
    effectivePermissions: ["portal.admin.access", "admin.attendance.manage", "admin.attendance.view"],
    widestScope: "ORGANIZATION",
    managedDepartmentIds: [],
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: false,
  };

  const hrManagerSession: SessionContext = {
    userId: "usr_hrmanager",
    employeeId: "EMP-003",
    name: "Meera HR-Manager",
    email: "hrmanager@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["HR_MANAGER"],
    effectivePermissions: ["portal.admin.access", "admin.attendance.manage", "admin.attendance.view"],
    widestScope: "ORGANIZATION",
    managedDepartmentIds: [],
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: false,
  };

  const employeeSession: SessionContext = {
    userId: "usr_employee",
    employeeId: "EMP-006",
    name: "Rohan Employee",
    email: "employee@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["EMPLOYEE"],
    effectivePermissions: ["portal.employee.access", "dash.attendance.view", "dash.attendance.record"],
    widestScope: "SELF",
    managedDepartmentIds: [],
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: false,
  };

  const otherEmployeeSession: SessionContext = {
    userId: "usr_other",
    employeeId: "EMP-005",
    name: "Vikram Team-Lead",
    email: "teammanager@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["TEAM_MANAGER"],
    effectivePermissions: ["portal.employee.access", "dash.attendance.view"],
    widestScope: "DIRECT_REPORTS",
    managedDepartmentIds: [],
    managedTeamIds: [],
    directReportIds: ["EMP-006"],
    isSuperAdmin: false,
  };

  beforeEach(async () => {
    process.env.PAYROLL_ACTIVE_KEY_VERSION = "v1";
    process.env.PAYROLL_ENCRYPTION_KEY_V1 = "16653300a8f4b5fd31651ab5e712f66368283ea90db280042d10f382ec4af16a";
    process.env.PAYROLL_ENCRYPTION_KEY_V2 = "54abd47926e62762db1c45bac2259cd138430a1214b9d6bc2bc370512e0956e8";
    await seedDatabase();
  });

  describe("Check-In Operations & Lateness Rules", () => {
    it("should successfully record on-time check-in and insert raw attendanceEvent", async () => {
      // 09:05 UTC (within 15 min grace of 09:00 shift start)
      const res = await recordCheckIn(employeeSession, "EMP-006", {
        timestampUtc: "2024-06-03T09:05:00.000Z",
        source: "WEB",
      });

      expect(res.status).toBe("PRESENT");
      expect(res.lateMinutes).toBe(0);

      // Verify raw event
      const events = await db
        .select()
        .from(attendanceEvents)
        .where(eq(attendanceEvents.attendanceRecordId, res.recordId));
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe("CHECK_IN");

      // Verify audit
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.targetId, res.recordId));
      expect(logs.some((l) => l.action === "ATTENDANCE_CHECK_IN")).toBe(true);
    });

    it("should accurately calculate late minutes when check-in exceeds grace period", async () => {
      // 09:35 UTC (35 mins past 09:00, 20 mins past 15 min grace)
      const res = await recordCheckIn(employeeSession, "EMP-006", {
        timestampUtc: "2024-06-03T09:35:00.000Z",
        source: "WEB",
      });

      expect(res.status).toBe("LATE");
      expect(res.lateMinutes).toBe(20);
    });

    it("should prevent duplicate check-in if employee is already checked in for today", async () => {
      await recordCheckIn(employeeSession, "EMP-006", {
        timestampUtc: "2024-06-03T09:00:00.000Z",
      });

      // Attempt second check-in on same day without checkout
      await expect(
        recordCheckIn(employeeSession, "EMP-006", {
          timestampUtc: "2024-06-03T09:10:00.000Z",
        })
      ).rejects.toThrow(/ALREADY_CHECKED_IN/);
    });

    it("should reject check-in by unauthorized third party", async () => {
      await expect(
        recordCheckIn(employeeSession, "EMP-004", {
          timestampUtc: "2024-06-03T09:00:00.000Z",
        })
      ).rejects.toThrow(/UNAUTHORIZED/);
    });
  });

  describe("Check-Out Operations & Work Duration Computation", () => {
    it("should compute total worked minutes, subtract break, and update daily status", async () => {
      // Check in at 09:00
      await recordCheckIn(employeeSession, "EMP-006", {
        timestampUtc: "2024-06-03T09:00:00.000Z",
      });

      // Check out at 18:00 (9 hours = 540 gross minutes, minus 60 min break = 480 net minutes)
      const outRes = await recordCheckOut(employeeSession, "EMP-006", {
        timestampUtc: "2024-06-03T18:00:00.000Z",
      });

      expect(outRes.totalWorkMinutes).toBe(480);
      expect(outRes.status).toBe("PRESENT");
      expect(outRes.earlyExitMinutes).toBe(0);

      // Verify checkout raw event
      const events = await db
        .select()
        .from(attendanceEvents)
        .where(eq(attendanceEvents.attendanceRecordId, outRes.recordId));
      expect(events.length).toBe(2);
      expect(events.some((e) => e.eventType === "CHECK_OUT")).toBe(true);
    });

    it("should classify attendance as HALF_DAY if worked minutes are under 240 minutes", async () => {
      // Check in at 09:00
      await recordCheckIn(employeeSession, "EMP-006", {
        timestampUtc: "2024-06-03T09:00:00.000Z",
      });

      // Check out after only 2.5 hours (150 mins)
      const outRes = await recordCheckOut(employeeSession, "EMP-006", {
        timestampUtc: "2024-06-03T11:30:00.000Z",
      });

      expect(outRes.totalWorkMinutes).toBe(150);
      expect(outRes.status).toBe("HALF_DAY");
    });

    it("should reject checkout if no active check-in exists for today", async () => {
      await expect(
        recordCheckOut(employeeSession, "EMP-006", {
          timestampUtc: "2024-06-03T18:00:00.000Z",
        })
      ).rejects.toThrow(/CHECK_IN_REQUIRED/);
    });
  });

  describe("Attendance Correction & Regularization Workflow", () => {
    it("should allow an employee to submit a correction request", async () => {
      const correction = await requestAttendanceCorrection(employeeSession, {
        date: "2024-06-03",
        requestedCheckInUtc: "2024-06-03T09:00:00.000Z",
        requestedCheckOutUtc: "2024-06-03T18:00:00.000Z",
        reason: "Biometric scanner power outage at office lobby",
      });

      expect(correction.id).toBeDefined();
      expect(correction.status).toBe("PENDING");

      // Verify request stored
      const stored = await db
        .select()
        .from(attendanceCorrectionRequests)
        .where(eq(attendanceCorrectionRequests.id, correction.id));
      expect(stored.length).toBe(1);
      expect(stored[0].reason).toContain("Biometric scanner power outage");
    });

    it("should allow HR/Admin to approve correction, updating attendance record to MANUAL_ADJUSTMENT", async () => {
      const correction = await requestAttendanceCorrection(employeeSession, {
        date: "2024-06-03",
        requestedCheckInUtc: "2024-06-03T09:00:00.000Z",
        requestedCheckOutUtc: "2024-06-03T18:00:00.000Z",
        reason: "Forgot card at home",
      });

      const reviewed = await reviewAttendanceCorrection(hrManagerSession, correction.id, {
        status: "APPROVED",
      });

      expect(reviewed.status).toBe("APPROVED");

      // Verify attendance record was regularized
      const records = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.employeeId, "EMP-006"),
            eq(attendanceRecords.date, "2024-06-03")
          )
        );

      expect(records.length).toBe(1);
      expect(records[0].source).toBe("MANUAL_ADJUSTMENT");
      expect(records[0].status).toBe("PRESENT");
      expect(records[0].totalWorkMinutes).toBe(480);
    });

    it("should allow HR to perform direct manual adjustment with mandatory reason", async () => {
      const res = await manualAttendanceAdjustment(adminSession, "EMP-006", {
        date: "2024-06-04",
        checkInTimeUtc: "2024-06-04T09:00:00.000Z",
        checkOutTimeUtc: "2024-06-04T18:00:00.000Z",
        status: "PRESENT",
        notes: "Offsite client deployment approved by HR Director",
      });

      expect(res.status).toBe("PRESENT");
      expect(res.totalWorkMinutes).toBe(480);

      // Verify stored record
      const records = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.employeeId, "EMP-006"),
            eq(attendanceRecords.date, "2024-06-04")
          )
        );
      expect(records.length).toBe(1);
      expect(records[0].notes).toContain("Offsite client deployment");
    });
  });

  describe("Scope Enforcement on Attendance Queries", () => {
    it("should allow SuperAdmin and Admin to view organization-wide attendance", async () => {
      await recordCheckIn(employeeSession, "EMP-006", {
        timestampUtc: "2024-06-03T09:00:00.000Z",
      });

      const list = await getAttendanceRecords(adminSession, { date: "2024-06-03" });
      expect(list.length).toBeGreaterThan(0);
      expect(list.some((r) => r.employeeCode === "EMP-006")).toBe(true);
    });

    it("should restrict regular Employee under SELF scope to their own records only", async () => {
      await recordCheckIn(employeeSession, "EMP-006", {
        timestampUtc: "2024-06-03T09:00:00.000Z",
      });

      const list = await getAttendanceRecords(employeeSession, { date: "2024-06-03" });
      for (const r of list) {
        expect(r.employeeCode).toBe("EMP-006");
      }
    });
  });
});
