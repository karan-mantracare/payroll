import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/evaluator";
import { ADMIN_MODULE_PERMISSIONS } from "@/lib/permissions/types";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";
import { desc, asc } from "drizzle-orm";
import { verifyAuditLogChain, AuditRecord } from "@/lib/audit/logger";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canViewAudit =
      session.isSuperAdmin ||
      hasPermission(session, ADMIN_MODULE_PERMISSIONS.ACCESS_VIEW);

    if (!canViewAudit) {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions to view audit logs" },
        { status: 403 }
      );
    }

    // Fetch chronologically for chain verification
    const records = await db
      .select()
      .from(auditLogs)
      .orderBy(asc(auditLogs.timestamp), asc(auditLogs.id));

    const verification = verifyAuditLogChain(records as AuditRecord[]);

    return NextResponse.json({
      records: records.slice(-50), // Return latest 50
      totalCount: records.length,
      integrity: {
        chainValid: verification.valid,
        error: verification.error,
        tamperedId: verification.tamperedId,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to query audit logs", details: err.message },
      { status: 500 }
    );
  }
}

