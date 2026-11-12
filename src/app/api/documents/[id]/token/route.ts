import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createDocumentDownloadToken } from "@/lib/documents/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const { id } = await params;
    const result = await createDocumentDownloadToken(session, id);

    return NextResponse.json({
      success: true,
      token: result.token,
      expiresInSeconds: result.expiresInSeconds,
      downloadUrl: `/payroll/api/documents/${id}/download?token=${result.token}`,
    });
  } catch (err: any) {
    const status = err.message.includes("SCOPE_VIOLATION") || err.message.includes("UNAUTHORIZED")
      ? 403
      : err.message.includes("DOCUMENT_NOT_FOUND")
      ? 404
      : 500;

    return NextResponse.json({ error: err.message }, { status });
  }
}

