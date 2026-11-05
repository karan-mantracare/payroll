import { NextRequest, NextResponse } from "next/server";
import { initiateLoginChallenge } from "@/lib/auth/direct";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const result = await initiateLoginChallenge(email, password);

    if (!result.success) {
      const status =
        result.code === "ACCOUNT_LOCKED"
          ? 423 // Locked
          : result.code === "EMPLOYEE_INACTIVE" || result.code === "ACCOUNT_INACTIVE"
          ? 403 // Forbidden
          : 401; // Unauthorized

      return NextResponse.json(
        {
          success: false,
          code: result.code,
          error: result.error,
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      challengeToken: result.challengeToken,
      emailMasked: result.emailMasked,
      expiresAt: result.expiresAt,
      isDevStaticEnabled: result.isDevStaticEnabled,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Authentication service error." },
      { status: 500 }
    );
  }
}

