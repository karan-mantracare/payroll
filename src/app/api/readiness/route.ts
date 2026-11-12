import { NextResponse } from "next/server";
import { checkStartupReadiness } from "@/lib/db/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await checkStartupReadiness();

  return NextResponse.json(
    report,
    { status: report.ready ? 200 : 503 }
  );
}

