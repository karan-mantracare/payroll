import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import {
  createProfileChangeRequest,
  getProfileChangeRequests,
  transitionProfileChangeRequest,
  type ProfileChangeField,
} from "@/lib/profile-requests/service";
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
    session.effectivePermissions.includes("employee.update")
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
      const requests = getProfileChangeRequests();
      return NextResponse.json({ success: true, requests });
    }

    const requests = session.employeeId ? getProfileChangeRequests(session.employeeId) : [];
    return NextResponse.json({ success: true, requests });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load profile change requests." },
      { status: 500 }
    );
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
        { error: "Active employee profile is required to submit a profile change request." },
        { status: 400 }
      );
    }

    const body = (await req.json()) as {
      field?: ProfileChangeField;
      requestedValue?: string;
      emergencyPhone?: string;
      reason?: string;
    };

    const record = await createProfileChangeRequest({
      employeeId: session.employeeId,
      actorUserId: session.userId,
      field: body.field as ProfileChangeField,
      requestedValue: body.requestedValue || "",
      emergencyPhone: body.emergencyPhone,
      reason: body.reason || "",
    });

    try {
      await notifyAdmins({
        title: `Profile Change Request (${record.employeeCode})`,
        message: `${session.name} requested an update to ${record.fieldLabel}: "${record.requestedValue}".`,
        category: "GENERAL",
        actionUrl: "/admin/approvals",
        excludeUserId: session.userId,
      });
    } catch {
      // Notification failure is non-blocking
    }

    return NextResponse.json({ success: true, request: record }, { status: 201 });
  } catch (err: any) {
    const msg = err?.message || "Failed to submit profile change request.";
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
      return NextResponse.json({ error: "requestId and action are required." }, { status: 400 });
    }

    const updated = await transitionProfileChangeRequest({
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
          await createNotification({
            recipientUserId: targetUserId,
            title: `Profile Change ${body.action === "APPROVE" ? "Approved" : "Declined"}`,
            message: `Your request to update ${updated.fieldLabel} to "${updated.requestedValue}" was ${
              body.action === "APPROVE" ? "approved" : "declined"
            }.`,
            category: "GENERAL",
            actionUrl: "/dash/profile",
          });
        }
      } catch {
        // Non-blocking notification
      }
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (err: any) {
    const msg = err?.message || "Failed to update profile change request.";
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

