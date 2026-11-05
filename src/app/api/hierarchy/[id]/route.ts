import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import {
  getReportingHierarchy,
  getManagerChain,
  getDirectReports,
  getManagerHistory,
} from "@/lib/hierarchy/service";
import { isEmployeeInScope } from "@/lib/scope/service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check scope authorization
    const inScope = await isEmployeeInScope(session, id);
    if (!inScope) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to view hierarchy for this employee." },
        { status: 403 }
      );
    }

    const [hierarchyTree, managerChain, directReports, history] = await Promise.all([
      getReportingHierarchy(id, session, 4),
      getManagerChain(id, session),
      getDirectReports(id, session),
      getManagerHistory(id, session),
    ]);

    return NextResponse.json({
      tree: hierarchyTree,
      managerChain,
      directReports,
      history,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch reporting hierarchy" },
      { status: 500 }
    );
  }
}

