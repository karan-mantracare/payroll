import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();

    if (!session) {
      return NextResponse.json(
        { authenticated: false, error: "No active session" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        employeeId: session.employeeId,
        name: session.name,
        email: session.email,
        roles: session.roles,
        permissions: session.effectivePermissions,
        widestScope: session.widestScope,
        isSuperAdmin: session.isSuperAdmin,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { authenticated: false, error: err.message },
      { status: 500 }
    );
  }
}
