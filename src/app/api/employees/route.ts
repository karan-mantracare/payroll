import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { getScopedEmployees } from "@/lib/scope/service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Active session required" },
        { status: 401 }
      );
    }

    const employeesList = await getScopedEmployees(session);

    return NextResponse.json({
      data: employeesList,
      scope: session.widestScope,
      count: employeesList.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch scoped employees", details: err.message },
      { status: 500 }
    );
  }
}
