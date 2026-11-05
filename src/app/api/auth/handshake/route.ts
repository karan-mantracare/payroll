import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Programs Platform SSO token handshake has been decommissioned in favor of direct authentication.",
      code: "SSO_DECOMMISSIONED",
      loginUrl: "/payrol/login",
    },
    { status: 410 }
  );
}
