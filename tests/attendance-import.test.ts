import { describe, it, expect, beforeEach } from "vitest";
import { runMigrations } from "../src/lib/db/migrate";
import { seedDatabase } from "../src/lib/db/seed";
import { db, rawClient } from "../src/lib/db/client";
import { attendanceRecords, auditLogs } from "../src/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { importMonthlyAttendance } from "../src/lib/attendance/service";
import { SessionContext } from "../src/lib/permissions/types";

describe("Phase 3 — Attendance Monthly Batch Import Engine", () => {
  beforeEach(async () => {
    await runMigrations();
    await seedDatabase();
  });

  const adminSession: SessionContext = {
    userId: "usr_admin",
    employeeId: "EMP-002",
    roles: ["ADMIN"],
    effectivePermissions: [
      "portal.admin.access",
      "admin.attendance.view",
      "admin.attendance.manage",
    ],
    widestScope: "ORGANIZATION",
    isSuperAdmin: false,
    organizationId: "org_mc_global",
  };

  const employeeSession: SessionContext = {
    userId: "usr_employee",
    employeeId: "EMP-006",
    roles: ["EMPLOYEE"],
    effectivePermissions: ["portal.employee.access", "employee.attendance.view"],
    widestScope: "SELF",
    isSuperAdmin: false,
    organizationId: "org_mc_global",
  };

  it("should successfully import valid attendance rows with employee-code mapping", async () => {
    const importRows = [
      {
        employeeCode: "EMP-008", // Admin Mantra
        date: "2026-11-01",
        checkInTime: "09:00",
        checkOutTime: "18:00",
        notes: "Monthly import test row 1",
      },
      {
        employeeCode: "EMP-009", // HRM Mantra
        date: "2026-11-01",
        checkInTime: "09:10",
        checkOutTime: "18:10",
        notes: "Monthly import test row 2",
      },
    ];

    const result = await importMonthlyAttendance(adminSession, importRows);
    expect(result.totalProcessed).toBe(2);
    expect(result.importedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Verify records exist in database
    const rec1 = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.date, "2026-11-01")));

    expect(rec1.length).toBeGreaterThanOrEqual(2);
    const emp8Rec = rec1.find((r) => r.notes?.includes("test row 1"));
    expect(emp8Rec).toBeDefined();
    expect(emp8Rec?.totalWorkMinutes).toBe(540); // 9 hours
    expect(emp8Rec?.status).toBe("PRESENT");
  });

  it("should detect and handle overnight shifts crossing midnight", async () => {
    const overnightRow = [
      {
        employeeCode: "EMP-008",
        date: "2026-11-02",
        checkInTime: "18:00",
        checkOutTime: "06:00", // Overnight crossing midnight -> 12 hours = 720 mins
        notes: "Overnight shift batch import",
      },
    ];

    const result = await importMonthlyAttendance(adminSession, overnightRow);
    expect(result.importedCount).toBe(1);

    const rec = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.date, "2026-11-02")));

    expect(rec).toHaveLength(1);
    expect(rec[0].totalWorkMinutes).toBe(720); // 12 hours across midnight
    expect(rec[0].checkOutTimeUtc).toContain("2026-11-03T06:00:00.000Z");
  });

  it("should detect duplicate records for same employee/date and update gracefully", async () => {
    const row1 = [
      {
        employeeCode: "EMP-008",
        date: "2026-11-03",
        checkInTime: "09:00",
        checkOutTime: "17:00",
        notes: "Initial record",
      },
    ];
    await importMonthlyAttendance(adminSession, row1);

    // Re-import with corrected checkout
    const row2 = [
      {
        employeeCode: "EMP-008",
        date: "2026-11-03",
        checkInTime: "09:00",
        checkOutTime: "18:30",
        notes: "Updated duplicate record",
      },
    ];
    const updateResult = await importMonthlyAttendance(adminSession, row2);
    expect(updateResult.importedCount).toBe(1);

    const check = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.date, "2026-11-03")));

    expect(check).toHaveLength(1); // exactly one record, no duplicates
    expect(check[0].totalWorkMinutes).toBe(570); // 9.5 hours
    expect(check[0].notes).toBe("Updated duplicate record");
  });

  it("should capture and report row-level errors for unknown employee codes or invalid formats", async () => {
    const invalidRows = [
      {
        employeeCode: "EMP-99999", // Non-existent
        date: "2026-11-04",
        checkInTime: "09:00",
      },
      {
        employeeCode: "EMP-008",
        date: "bad-date-format",
        checkInTime: "09:00",
      },
      {
        employeeCode: "EMP-008",
        date: "2026-11-04",
        checkInTime: "invalid-time",
      },
    ];

    const result = await importMonthlyAttendance(adminSession, invalidRows);
    expect(result.totalProcessed).toBe(3);
    expect(result.importedCount).toBe(0);
    expect(result.failedCount).toBe(3);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0].error).toContain("No employee found with code 'EMP-99999'");
    expect(result.errors[1].error).toContain("Invalid date format");
    expect(result.errors[2].error).toContain("Invalid check-in time format");
  });

  it("should enforce server-side RBAC and reject unauthorized non-admin import attempts", async () => {
    const rows = [
      {
        employeeCode: "EMP-006",
        date: "2026-11-05",
        checkInTime: "09:00",
        checkOutTime: "18:00",
      },
    ];

    await expect(
      importMonthlyAttendance(employeeSession, rows)
    ).rejects.toThrow(/UNAUTHORIZED/);
  });

  it("should log tamper-evident audit trail for batch attendance imports", async () => {
    const rows = [
      {
        employeeCode: "EMP-008",
        date: "2026-11-06",
        checkInTime: "09:00",
        checkOutTime: "18:00",
      },
    ];

    await importMonthlyAttendance(adminSession, rows);

    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "ATTENDANCE_MONTHLY_IMPORTED"));

    expect(logs.length).toBeGreaterThan(0);
    const lastLog = logs[logs.length - 1];
    expect(lastLog.actorUserId).toBe(adminSession.userId);
    expect(lastLog.changesJson).toContain("importedCount");
  });
});

