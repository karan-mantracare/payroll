import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: Date.now(),
    service: "mantracare-payroll",
    platform: "minis",
    version: "1.0.0",
  });
}

