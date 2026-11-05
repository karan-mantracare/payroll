import { describe, it, expect, beforeEach } from "vitest";
import { seedDatabase } from "../src/lib/db/seed";
import { db } from "../src/lib/db/client";
import { shifts, shiftAssignments, shiftHistory, auditLogs } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  listShifts,
  createShift,
  assignShiftToEmployee,
  getEmployeeShiftForDate,
  getEmployeeShiftCalendar,
} from "../src/lib/shifts/service";
import { SessionContext } from "../src/lib/permissions/types";

describe("Phase 3 — Shifts & Rotational Scheduling Engine", () => {
  const adminSession: SessionContext = {
    userId: "usr_admin",
    employeeId: "EMP-002",
    name: "Aakash Admin",
    email: "admin@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["ADMIN"],
    effectivePermissions: ["portal.admin.access", "admin.shifts.manage", "admin.shifts.view"],
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
    effectivePermissions: ["portal.employee.access", "dash.shifts.view"],
    widestScope: "SELF",
    managedDepartmentIds: [],
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: false,
  };

  beforeEach(async () => {
    process.env.PAYROLL_ACTIVE_KEY_VERSION = "v1";
    process.env.PAYROLL_ENCRYPTION_KEY_V1 = "16653300a8f4b5fd31651ab5e712f66368283ea90db280042d10f382ec4af16a";
    process.env.PAYROLL_ENCRYPTION_KEY_V2 = "54abd47926e62762db1c45bac2259cd138430a1214b9d6bc2bc370512e0956e8";
    await seedDatabase();
  });

  describe("Shift Definitions & Rules", () => {
    it("should list default seeded shifts", async () => {
      const shiftList = await listShifts(adminSession);
      expect(shiftList.length).toBeGreaterThanOrEqual(3);
      const codes = shiftList.map((s) => s.code);
      expect(codes).toContain("GENERAL");
      expect(codes).toContain("MORNING");
      expect(codes).toContain("NIGHT");
    });

    it("should create a new custom shift with valid 24h timings and audit log", async () => {
      const newShift = await createShift(adminSession, {
        name: "Evening Rotational Shift",
        code: "EVENING_ROT",
        startTime: "14:00",
        endTime: "23:00",
        breakDurationMinutes: 45,
      });

      expect(newShift.id).toBeDefined();
      expect(newShift.code).toBe("EVENING_ROT");

      // Verify persistence
      const stored = await db.select().from(shifts).where(eq(shifts.code, "EVENING_ROT"));
      expect(stored.length).toBe(1);

      // Verify audit
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.targetId, newShift.id));
      expect(logs.some((l) => l.action === "SHIFT_CREATED")).toBe(true);
    });

    it("should reject duplicate shift codes", async () => {
      await expect(
        createShift(adminSession, {
          name: "Duplicate General",
          code: "GENERAL",
          startTime: "09:00",
          endTime: "18:00",
        })
      ).rejects.toThrow(/SHIFT_CODE_EXISTS/);
    });

    it("should reject invalid time formats", async () => {
      await expect(
        createShift(adminSession, {
          name: "Bad Format",
          code: "BAD_FMT",
          startTime: "9:00 AM", // Invalid format
          endTime: "18:00",
        })
      ).rejects.toThrow(/INVALID_TIME_FORMAT/);
    });
  });

  describe("Employee Shift Assignments & Rotational Schedules", () => {
    it("should assign an employee to a shift and close previous overlapping assignments", async () => {
      const allShifts = await listShifts(adminSession);
      const nightShift = allShifts.find((s) => s.code === "NIGHT")!;

      const assignment = await assignShiftToEmployee(adminSession, {
        employeeIdOrCode: "EMP-006",
        shiftId: nightShift.id,
        startDate: "2024-06-01",
        patternDays: ["MON", "TUE", "WED", "THU", "FRI"],
        reason: "Transferred to Night Shift for Q3 Operations",
      });

      expect(assignment.shiftCode).toBe("NIGHT");

      // Check shift assignment record
      const stored = await db.select().from(shiftAssignments).where(eq(shiftAssignments.id, assignment.assignmentId));
      expect(stored.length).toBe(1);

      // Check shift history record
      const history = await db.select().from(shiftHistory).where(eq(shiftHistory.employeeId, "EMP-006"));
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].newShiftId).toBe(nightShift.id);

      // Check audit
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.targetId, assignment.assignmentId));
      expect(logs.some((l) => l.action === "SHIFT_ASSIGNED")).toBe(true);
    });

    it("should correctly resolve working days vs rest days based on patternDays", async () => {
      // Seed data assigns EMP-006 to GENERAL shift (MON-FRI)
      // 2024-06-03 was a Monday (Working Day)
      const mondayShift = await getEmployeeShiftForDate("EMP-006", "2024-06-03");
      expect(mondayShift).not.toBeNull();
      expect(mondayShift?.isWorkingDay).toBe(true);
      expect(mondayShift?.dayOfWeek).toBe("MON");

      // 2024-06-08 was a Saturday (Rest Day)
      const saturdayShift = await getEmployeeShiftForDate("EMP-006", "2024-06-08");
      expect(saturdayShift).not.toBeNull();
      expect(saturdayShift?.isWorkingDay).toBe(false);
      expect(saturdayShift?.dayOfWeek).toBe("SAT");
    });

    it("should return a multi-day schedule calendar for employee self-service", async () => {
      const calendar = await getEmployeeShiftCalendar(employeeSession, "EMP-006", "2024-06-01", "2024-06-07");
      expect(calendar.length).toBe(7);
      expect(calendar[0].date).toBe("2024-06-01");
      expect(calendar[6].date).toBe("2024-06-07");
    });
  });
});
