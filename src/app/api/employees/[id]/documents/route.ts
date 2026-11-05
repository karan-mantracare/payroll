import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import {
  getEmployeeDocuments,
  uploadEmployeeDocument,
} from "@/lib/documents/service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const documents = await getEmployeeDocuments(session, id, includeArchived);
    return NextResponse.json({ success: true, documents });
  } catch (err: any) {
    const status = err.message.includes("SCOPE_VIOLATION") || err.message.includes("UNAUTHORIZED")
      ? 403
      : err.message.includes("EMPLOYEE_NOT_FOUND")
      ? 404
      : 500;

    return NextResponse.json({ error: err.message }, { status });
  }
}

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
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const documentType = formData.get("documentType") as string | null;
    const replacesDocumentId = (formData.get("replacesDocumentId") as string) || undefined;

    if (!file || !documentType) {
      return NextResponse.json(
        { error: "INVALID_INPUT: 'file' and 'documentType' are required fields." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const uploaded = await uploadEmployeeDocument(
      session,
      id,
      {
        documentName: file.name,
        documentType,
        buffer,
        mimeType: file.type || "application/octet-stream",
        replacesDocumentId,
      },
      { ipAddress, userAgent }
    );

    return NextResponse.json({ success: true, document: uploaded }, { status: 201 });
  } catch (err: any) {
    const status = err.message.includes("SCOPE_VIOLATION") || err.message.includes("UNAUTHORIZED")
      ? 403
      : err.message.includes("INVALID_") || err.message.includes("FILE_TOO_LARGE") || err.message.includes("UNSUPPORTED")
      ? 400
      : 500;

    return NextResponse.json({ error: err.message }, { status });
  }
}
