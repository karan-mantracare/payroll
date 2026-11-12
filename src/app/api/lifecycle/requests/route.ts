import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import {
  createJmlRequest,
  getEmployeeJmlContext,
  getJmlLookupOptions,
  getJmlRequests,
  transitionJmlRequest,
  type JmlLeaveCategory,
  type JmlMoveCategory,
  type JmlRequestType,
} from "@/lib/lifecycle/service";
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
    session.effectivePermissions.includes("admin.lifecycle.manage")
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
      const requests = getJmlRequests();
      return NextResponse.json({
        success: true,
        requests,
        stats: {
          totalRequests: requests.length,
          moverPending: requests.filter((r) => r.requestType === "MOVE" && r.status === "PENDING").length,
          leaverPending: requests.filter((r) => r.requestType === "LEAVE" && r.status === "PENDING").length,
          moverApproved: requests.filter((r) => r.requestType === "MOVE" && r.status === "APPROVED").length,
          leaverApproved: requests.filter((r) => r.requestType === "LEAVE" && r.status === "APPROVED").length,
        },
      });
    }

    const [profile, options] = await Promise.all([
      session.employeeId ? getEmployeeJmlContext(session.employeeId) : Promise.resolve(null),
      getJmlLookupOptions(),
    ]);

    const requests = session.employeeId ? getJmlRequests(session.employeeId) : [];

    return NextResponse.json({
      success: true,
      profile,
      options,
      requests,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load lifecycle requests." }, { status: 500 });
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
        { error: "Active employee profile is required to submit a Move or Leave request." },
        { status: 400 }
      );
    }

    const body = (await req.json()) as {
      requestType?: JmlRequestType;
      effectiveDate?: string;
      reason?: string;
      moveCategory?: JmlMoveCategory;
      targetDepartmentId?: string | null;
      targetLocationId?: string | null;
      targetTeamId?: string | null;
      targetJobTitle?: string | null;
      leaveCategory?: JmlLeaveCategory;
      noticePeriodDays?: number;
      handoverPlan?: string;
    };

    if (body.requestType !== "MOVE" && body.requestType !== "LEAVE") {
      return NextResponse.json(
        { error: "INVALID_REQUEST_TYPE: requestType must be MOVE or LEAVE." },
        { status: 400 }
      );
    }

    const record = await createJmlRequest({
      employeeId: session.employeeId,
      employeeName: session.name,
      employeeEmail: session.email,
      actorUserId: session.userId,
      requestType: body.requestType,
      effectiveDate: body.effectiveDate || "",
      reason: body.reason || "",
      moveCategory: body.moveCategory,
      targetDepartmentId: body.targetDepartmentId,
      targetLocationId: body.targetLocationId,
      targetTeamId: body.targetTeamId,
      targetJobTitle: body.targetJobTitle,
      leaveCategory: body.leaveCategory,
      noticePeriodDays: body.noticePeriodDays,
      handoverPlan: body.handoverPlan,
    });

    try {
      const label = record.requestType === "MOVE" ? "Move / Transfer" : "Leave / Exit";
      await notifyAdmins({
        title: `JML ${label} Request (${record.employeeCode})`,
        message: `${session.name} submitted a ${label.toLowerCase()} request effective ${record.effectiveDate}.`,
        category: "SYSTEM",
        actionUrl: "/admin/lifecycle",
        excludeUserId: session.userId,
      });
    } catch {
      // Notification failure must not block request creation
    }

    return NextResponse.json({ success: true, request: record }, { status: 201 });
  } catch (err: any) {
    const msg = err?.message || "Failed to create JML request.";
    const status =
      msg.includes("REQUIRED") || msg.includes("INVALID_")
        ? 400
        : msg.includes("NOT_FOUND")
        ? 404
        : 500;
    return NextResponse.json({ error: msg }, { status });
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
      action?: "APPROVE" | "REJECT" | "WITHDRAW";
      reviewComment?: string;
    };

    if (!body.requestId || !body.action) {
      return NextResponse.json(
        { error: "requestId and action are required." },
        { status: 400 }
      );
    }

    const updated = await transitionJmlRequest({
      requestId: body.requestId,
      action: body.action,
      actorUserId: session.userId,
      actorName: session.name,
      isAdmin: isHrOrAdmin(session),
      actorEmployeeId: session.employeeId,
      reviewComment: body.reviewComment,
    });

    if (body.action === "APPROVE" || body.action === "REJECT") {
      try {
        const targetUserId = await resolveUserIdForEmployee(updated.employeeId);
        if (targetUserId) {
          const kindLabel = updated.requestType === "MOVE" ? "Move / Transfer" : "Exit / Offboarding";
          await createNotification({
            recipientUserId: targetUserId,
            title: `JML ${kindLabel} ${body.action === "APPROVE" ? "Approved" : "Declined"}`,
            message: `Your ${kindLabel.toLowerCase()} request for ${updated.effectiveDate} was ${
              body.action === "APPROVE" ? "approved" : "declined"
            }.${updated.reviewComment ? ` Note: ${updated.reviewComment}` : ""}`,
            category: "SYSTEM",
            actionUrl: "/dash/onboarding",
          });
        }
      } catch {
        // Non-blocking notification
      }
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (err: any) {
    const msg = err?.message || "Failed to update JML request.";
    const status = msg.includes("FORBIDDEN")
      ? 403
      : msg.includes("NOT_FOUND")
      ? 404
      : msg.includes("INVALID_")
      ? 400
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

