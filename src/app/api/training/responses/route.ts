import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { getModuleResponsesAnalytics, getTrainingModules } from "@/lib/training/service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const moduleId = searchParams.get("moduleId");

    if (!moduleId) {
      // If no moduleId provided, return all modules overview
      const modules = getTrainingModules();
      const analyticsList = await Promise.all(
        modules.map((m) => getModuleResponsesAnalytics(m.id))
      );
      return NextResponse.json({
        success: true,
        modules: analyticsList.filter(Boolean),
      });
    }

    const data = await getModuleResponsesAnalytics(moduleId);
    if (!data) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    console.error("Error in /api/training/responses:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch responses" }, { status: 500 });
  }
}

