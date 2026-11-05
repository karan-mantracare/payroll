import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { generateEmployeeCsv } from "@/lib/export/csv";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filterDepartmentId = searchParams.get("departmentId") || undefined;
    const filterStatus = searchParams.get("status") || undefined;

    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const csvContent = await generateEmployeeCsv(
      session,
      { filterDepartmentId, filterStatus },
      { ipAddress, userAgent }
    );

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `mantracare_employees_export_${dateStr}.csv`;

    const headers = new Headers();
    headers.set("Content-Type", "text/csv; charset=utf-8");
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

    return new NextResponse(csvContent, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    const status = err.message.includes("SCOPE_VIOLATION") || err.message.includes("UNAUTHORIZED")
      ? 403
      : 500;

    return NextResponse.json({ error: err.message }, { status });
  }
}

