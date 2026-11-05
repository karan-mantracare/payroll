import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { getDocumentStream } from "@/lib/documents/service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token") || undefined;

    let session = null;
    if (!token) {
      session = await getSessionContext();
      if (!session) {
        return NextResponse.json(
          { error: "Unauthorized: Valid session or download token required" },
          { status: 401 }
        );
      }
    }

    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const file = await getDocumentStream(session, id, token, { ipAddress, userAgent });

    const encodedFileName = encodeURIComponent(file.fileName).replace(/['()]/g, escape);
    const headers = new Headers();
    headers.set("Content-Type", file.mimeType);
    headers.set("Content-Length", file.buffer.length.toString());
    headers.set(
      "Content-Disposition",
      `attachment; filename="${file.fileName.replace(/"/g, "")}"; filename*=UTF-8''${encodedFileName}`
    );
    headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers,
    });
  } catch (err: any) {
    const status = err.message.includes("SCOPE_VIOLATION") || err.message.includes("UNAUTHORIZED")
      ? 403
      : err.message.includes("INVALID_DOWNLOAD_TOKEN")
      ? 401
      : err.message.includes("DOCUMENT_NOT_FOUND") || err.message.includes("FILE_NOT_FOUND")
      ? 404
      : 500;

    return NextResponse.json({ error: err.message }, { status });
  }
}
