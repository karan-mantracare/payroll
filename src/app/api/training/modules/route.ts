import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import {
  getTrainingModules,
  createTrainingModule,
  updateTrainingModule,
  deleteTrainingModule,
} from "@/lib/training/service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const modules = getTrainingModules();
    return NextResponse.json({ success: true, modules });
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

    const canManage =
      session.isSuperAdmin ||
      session.roles.includes("SUPER_ADMIN") ||
      session.roles.includes("ADMIN") ||
      session.roles.includes("HR_MANAGER");

    if (!canManage) {
      return NextResponse.json(
        { error: "Insufficient permissions to add training modules" },
        { status: 403 }
      );
    }

    const body = await req.json();

    if (!body.title || !body.code) {
      return NextResponse.json(
        { error: "Module title and track code are required" },
        { status: 400 }
      );
    }

    const created = createTrainingModule({
      title: body.title.trim(),
      code: body.code.trim().toUpperCase(),
      category: body.category || "Compliance",
      description: body.description || "",
      targetDepartment: body.targetDepartment || "All Departments",
      passingScorePercent: Number(body.passingScorePercent) || 80,
      require100PercentVideoCompletion: body.require100PercentVideoCompletion !== false,
      videos: Array.isArray(body.videos) ? body.videos : [],
      hasTest: Boolean(body.hasTest),
      questions: Array.isArray(body.questions) ? body.questions : [],
    });

    return NextResponse.json({ success: true, module: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canManage =
      session.isSuperAdmin ||
      session.roles.includes("SUPER_ADMIN") ||
      session.roles.includes("ADMIN") ||
      session.roles.includes("HR_MANAGER");

    if (!canManage) {
      return NextResponse.json(
        { error: "Insufficient permissions to update training modules" },
        { status: 403 }
      );
    }

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "Module ID required" }, { status: 400 });
    }

    const updated = updateTrainingModule(body.id, body);
    if (!updated) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, module: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Module ID required" }, { status: 400 });
    }

    const success = deleteTrainingModule(id);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
