import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { employees } from "@/lib/db/schema";
import {
  type AbsenceType,
  createLeaveRequest,
  getEmployeeLeaveSummary,
  getLeaveRequests,
  transitionLeaveRequest,
} from "@/lib/leaves/service";
import {
  createNotification,
  notifyAdmins,
  resolveUserIdForEmployee,
} from "@/lib/notifications/service";

function isHrOrAdmin(session: {
  isSuperAdmin?: boolean;
  roles: string[];
  effectivePermissions: string[];
}) {
  return (
    Boolean(session.isSuperAdmin) ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes("admin.leaves.manage")
  );
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");

    if (scope === "all" && isHrOrAdmin(session)) {
      return NextResponse.json({
        success: true,
        requests: getLeaveRequests(),
      });
    }

    if (!session.employeeId) {
      return NextResponse.json({
        success: true,
        balances: [
          { absenceType: "PRIVILEGE_LEAVE", label: "Privilege Leave", quota: 18, used: 0, pending: 0, remaining: 18 },
          { absenceType: "CASUAL_LEAVE", label: "Casual Leave", quota: 12, used: 0, pending: 0, remaining: 12 },
          { absenceType: "SICK_LEAVE", label: "Sick Leave", quota: 10, used: 0, pending: 0, remaining: 10 },
        ],
        requests: [],
      });
    }

    const summary = getEmployeeLeaveSummary(session.employeeId);
    return NextResponse.json({
      success: true,
      balances: summary.balances,
      requests: summary.requests,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!session.employeeId) {
      return NextResponse.json(
        { error: "Active employee profile is required to apply for leave." },
        { status: 400 }
      );
    }

    const empRows = await db
      .select({ employeeCode: employees.employeeCode })
      .from(employees)
      .where(eq(employees.id, session.employeeId))
      .limit(1);

    const employeeCode = empRows[0]?.employeeCode || "EMP";
    const body = (await req.json()) as {
      startDate?: string;
      endDate?: string;
      absenceType?: AbsenceType;
      reason?: string;
      mode?: "DRAFT" | "PENDING";
    };

    const status = body.mode === "DRAFT" ? "DRAFT" : "PENDING";
    const record = createLeaveRequest({
      employeeId: session.employeeId,
      employeeCode,
      employeeName: session.name,
      employeeEmail: session.email,
      startDate: body.startDate || "",
      endDate: body.endDate || "",
      absenceType: body.absenceType as AbsenceType,
      reason: body.reason,
      status,
    });

    if (status === "PENDING") {
      try {
        await notifyAdmins({
          title: `Leave Application Submitted (${employeeCode})`,
          message: `${session.name} applied for ${record.totalDays} day(s) of ${record.absenceType.replace("_", " ").toLowerCase()} (${record.startDate} to ${record.endDate}).`,
          category: "LEAVE",
          actionUrl: "/admin/leaves",
          excludeUserId: session.userId,
        });
      } catch (err) {
        console.warn("Non-fatal notification dispatch failure:", err);
      }
    }

    const summary = getEmployeeLeaveSummary(session.employeeId);
    return NextResponse.json(
      {
        success: true,
        request: record,
        balances: summary.balances,
        requests: summary.requests,
      },
      { status: 201 }
    );
  } catch (err: any) {
    const isClientError =
      err.message?.includes("REQUIRED") ||
      err.message?.includes("INVALID_") ||
      err.message?.includes("INSUFFICIENT_BALANCE");
    return NextResponse.json(
      { error: err.message || "Failed to submit leave request" },
      { status: isClientError ? 400 : 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      requestId?: string;
      action?: "APPLY_DRAFT" | "CANCEL" | "APPROVE" | "REJECT";
      rejectionReason?: string;
    };

    if (!body.requestId || !body.action) {
      return NextResponse.json(
        { error: "requestId and action are required." },
        { status: 400 }
      );
    }

    const updated = transitionLeaveRequest({
      requestId: body.requestId,
      actorEmployeeId: session.employeeId,
      actorUserId: session.userId,
      isAdmin: isHrOrAdmin(session),
      action: body.action,
      rejectionReason: body.rejectionReason,
    });

    if (body.action === "APPLY_DRAFT") {
      try {
        await notifyAdmins({
          title: `Leave Application Submitted (${updated.employeeCode})`,
          message: `${updated.employeeName} submitted a draft leave request for ${updated.startDate} to ${updated.endDate}.`,
          category: "LEAVE",
          actionUrl: "/admin/leaves",
          excludeUserId: session.userId,
        });
      } catch (err) {
        console.warn("Non-fatal notification dispatch failure:", err);
      }
    } else if (body.action === "APPROVE" || body.action === "REJECT") {
      try {
        const recipientUserId = await resolveUserIdForEmployee(updated.employeeId);
        if (recipientUserId) {
          await createNotification({
            recipientUserId,
            title: `Leave Application ${body.action === "APPROVE" ? "Approved" : "Rejected"}`,
            message: `Your leave request (${updated.startDate} to ${updated.endDate}) was ${updated.status.toLowerCase()}.`,
            category: "LEAVE",
            actionUrl: "/dash/leaves",
          });
        }
      } catch (err) {
        console.warn("Non-fatal notification dispatch failure:", err);
      }
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (err: any) {
    const isClientError =
      err.message?.includes("NOT_FOUND") ||
      err.message?.includes("FORBIDDEN") ||
      err.message?.includes("INVALID_STATE") ||
      err.message?.includes("INSUFFICIENT_BALANCE");
    return NextResponse.json(
      { error: err.message || "Failed to update leave application" },
      { status: isClientError ? 400 : 500 }
    );
  }
}

