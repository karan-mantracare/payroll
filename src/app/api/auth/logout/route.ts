import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, revokeSession } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (sessionCookie?.value) {
      await revokeSession(sessionCookie.value);
    }

    const response = NextResponse.json({ success: true, message: "Logged out successfully" });
    response.cookies.delete({
      name: SESSION_COOKIE_NAME,
      path: "/payrol",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
