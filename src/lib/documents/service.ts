import { db } from "../db/client";
import { employeeDocuments, employees, users } from "../db/schema";
import { eq, desc, and, or, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { documentStorage, validateMagicBytes } from "../storage";
import { encryptField, decryptField } from "../security/crypto";
import { auditLogger } from "../audit/logger";
import { SessionContext } from "../permissions/types";
import { resolveEmployee } from "../hierarchy/service";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

export interface UploadDocumentInput {
  documentType: string;
  documentName: string;
  buffer: Buffer;
  mimeType: string;
  replacesDocumentId?: string;
  expiresAt?: number;
}

export interface VerifyDocumentInput {
  status: "VERIFIED" | "REJECTED";
  rejectionReason?: string;
}

/**
 * Validates whether the caller's session scope allows accessing the target employee's documents.
 */
export async function verifyDocumentScopeAccess(
  session: SessionContext,
  targetEmployeeIdOrCode: string,
  requiredPermission: string
): Promise<any> {
  const employee = await resolveEmployee(targetEmployeeIdOrCode);
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND: Target employee record not found.");
  }

  // Super admin override
  if (session.isSuperAdmin || session.roles.includes("SUPER_ADMIN")) {
    return employee;
  }

  // Self scope
  const isSelf =
    session.employeeId === employee.id ||
    session.employeeId === employee.employeeCode ||
    session.userId === employee.userId;

  if (isSelf) {
    return employee;
  }

  // Verify permission
  const hasPerm =
    session.roles.includes("ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes(requiredPermission) ||
    session.effectivePermissions.includes("documents.manage");

  if (!hasPerm) {
    throw new Error(`UNAUTHORIZED: Missing required permission ${requiredPermission}.`);
  }

  // Scope validation
  switch (session.widestScope) {
    case "ORGANIZATION":
      return employee;

    case "DEPARTMENT":
      if (!session.managedDepartmentIds.includes(employee.departmentId)) {
        throw new Error("SCOPE_VIOLATION: Employee belongs to department outside caller's authorized scope.");
      }
      return employee;

    case "TEAM":
      if (!employee.teamId || !session.managedTeamIds.includes(employee.teamId)) {
        throw new Error("SCOPE_VIOLATION: Employee belongs to team outside caller's authorized scope.");
      }
      return employee;

    case "DIRECT_REPORTS":
      if (
        !session.directReportIds.includes(employee.id) &&
        !session.directReportIds.includes(employee.employeeCode) &&
        employee.managerId !== session.employeeId
      ) {
        throw new Error("SCOPE_VIOLATION: Employee is not a direct report within caller's authorized scope.");
      }
      return employee;

    case "SELF":
      throw new Error("SCOPE_VIOLATION: Access denied under SELF scope for other employee records.");

    default:
      throw new Error("SCOPE_VIOLATION: Unknown or unauthorized data scope.");
  }
}

/**
 * Uploads a document to the private Document Vault.
 */
export async function uploadEmployeeDocument(
  session: SessionContext,
  employeeIdOrCode: string,
  input: UploadDocumentInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const employee = await verifyDocumentScopeAccess(session, employeeIdOrCode, "documents.upload");

  // 1. Validate file constraints
  if (!input.buffer || input.buffer.length === 0) {
    throw new Error("INVALID_DOCUMENT: File buffer cannot be empty.");
  }

  if (input.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`FILE_TOO_LARGE: Document exceeds maximum allowable size of 10MB.`);
  }

  if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
    throw new Error(`UNSUPPORTED_MEDIA_TYPE: MIME type ${input.mimeType} is not permitted in Document Vault.`);
  }

  if (!validateMagicBytes(input.buffer, input.mimeType)) {
    throw new Error("INVALID_FILE_SIGNATURE: File header magic bytes do not match declared MIME type.");
  }

  // 2. Determine document version and replacement
  let version = 1;
  let replacedDocId: string | null = null;

  if (input.replacesDocumentId) {
    const existingDocs = await db
      .select()
      .from(employeeDocuments)
      .where(
        and(
          eq(employeeDocuments.id, input.replacesDocumentId),
          eq(employeeDocuments.employeeId, employee.id)
        )
      )
      .limit(1);

    if (existingDocs.length > 0) {
      const prevDoc = existingDocs[0];
      version = prevDoc.version + 1;
      replacedDocId = prevDoc.id;

      // Mark previous version as ARCHIVED
      await db
        .update(employeeDocuments)
        .set({ status: "ARCHIVED", updatedAt: Date.now() })
        .where(eq(employeeDocuments.id, prevDoc.id));
    }
  }

  // 3. Save to private storage provider
  const stored = await documentStorage.save(input.buffer, input.documentName, input.mimeType);

  // 4. Encrypt storage key at rest
  const storagePathEncrypted = encryptField(stored.storageKey);

  const now = Date.now();
  const documentId = `doc_${randomUUID()}`;

  // 5. Persist document metadata in Turso
  await db.insert(employeeDocuments).values({
    id: documentId,
    employeeId: employee.id,
    documentType: input.documentType,
    documentName: stored.originalName,
    fileSize: stored.sizeBytes,
    mimeType: stored.mimeType,
    storagePathEncrypted,
    fileHash: stored.sha256Hash,
    version,
    replacedDocumentId: replacedDocId,
    verificationStatus: "PENDING",
    status: "ACTIVE",
    uploadedByUserId: session.userId,
    expiresAt: input.expiresAt || null,
    createdAt: now,
    updatedAt: now,
  });

  // 6. Append tamper-evident audit record
  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "DOCUMENT_UPLOADED",
    targetEntity: "employee_documents",
    targetId: documentId,
    changes: {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      documentType: input.documentType,
      documentName: stored.originalName,
      fileSize: stored.sizeBytes,
      mimeType: stored.mimeType,
      fileHash: stored.sha256Hash,
      version,
      replacedDocumentId: replacedDocId,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    id: documentId,
    documentName: stored.originalName,
    documentType: input.documentType,
    fileSize: stored.sizeBytes,
    mimeType: stored.mimeType,
    fileHash: stored.sha256Hash,
    version,
    verificationStatus: "PENDING",
    createdAt: now,
  };
}

/**
 * Retrieves all documents for an employee.
 */
export async function getEmployeeDocuments(
  session: SessionContext,
  employeeIdOrCode: string,
  includeArchived = false
) {
  const employee = await verifyDocumentScopeAccess(session, employeeIdOrCode, "documents.view");

  const query = db
    .select({
      id: employeeDocuments.id,
      employeeId: employeeDocuments.employeeId,
      documentType: employeeDocuments.documentType,
      documentName: employeeDocuments.documentName,
      fileSize: employeeDocuments.fileSize,
      mimeType: employeeDocuments.mimeType,
      fileHash: employeeDocuments.fileHash,
      version: employeeDocuments.version,
      replacedDocumentId: employeeDocuments.replacedDocumentId,
      verificationStatus: employeeDocuments.verificationStatus,
      verifiedByUserId: employeeDocuments.verifiedByUserId,
      verifiedAt: employeeDocuments.verifiedAt,
      rejectionReason: employeeDocuments.rejectionReason,
      status: employeeDocuments.status,
      uploadedByUserId: employeeDocuments.uploadedByUserId,
      createdAt: employeeDocuments.createdAt,
      updatedAt: employeeDocuments.updatedAt,
    })
    .from(employeeDocuments)
    .where(
      includeArchived
        ? eq(employeeDocuments.employeeId, employee.id)
        : and(
            eq(employeeDocuments.employeeId, employee.id),
            eq(employeeDocuments.status, "ACTIVE")
          )
    )
    .orderBy(desc(employeeDocuments.createdAt));

  return await query;
}

/**
 * Generates a short-lived download token (15 mins TTL) for a document.
 */
export async function createDocumentDownloadToken(
  session: SessionContext,
  documentId: string
): Promise<{ token: string; expiresInSeconds: number }> {
  const docRows = await db
    .select()
    .from(employeeDocuments)
    .where(eq(employeeDocuments.id, documentId))
    .limit(1);

  if (docRows.length === 0) {
    throw new Error("DOCUMENT_NOT_FOUND: Requested document does not exist.");
  }

  const doc = docRows[0];
  await verifyDocumentScopeAccess(session, doc.employeeId, "documents.view");

  const ttlSeconds = 900;
  const token = documentStorage.generateDownloadToken(doc.id, session.userId, ttlSeconds);

  return { token, expiresInSeconds: ttlSeconds };
}

/**
 * Streams document contents verifying token or direct session.
 */
export async function getDocumentStream(
  session: SessionContext | null,
  documentId: string,
  token?: string,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const docRows = await db
    .select()
    .from(employeeDocuments)
    .where(eq(employeeDocuments.id, documentId))
    .limit(1);

  if (docRows.length === 0) {
    throw new Error("DOCUMENT_NOT_FOUND: Requested document does not exist.");
  }

  const doc = docRows[0];

  // Validate authorization either through download token or valid session
  if (token) {
    const verified = documentStorage.verifyDownloadToken(token);
    if (!verified.valid || verified.documentId !== doc.id) {
      throw new Error("INVALID_DOWNLOAD_TOKEN: Download token is invalid or has expired.");
    }
  } else if (session) {
    await verifyDocumentScopeAccess(session, doc.employeeId, "documents.view");
  } else {
    throw new Error("UNAUTHORIZED: Must provide valid session or download token.");
  }

  // Decrypt storage path
  const storageKey = decryptField(doc.storagePathEncrypted);
  const file = await documentStorage.getStream(storageKey);

  // Log download audit event
  if (session) {
    await auditLogger.logAuditEvent({
      actorUserId: session.userId,
      actorEmployeeId: session.employeeId,
      action: "DOCUMENT_DOWNLOADED",
      targetEntity: "employee_documents",
      targetId: doc.id,
      changes: {
        documentName: doc.documentName,
        documentType: doc.documentType,
        fileSize: doc.fileSize,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });
  }

  return {
    buffer: file.buffer,
    mimeType: doc.mimeType,
    fileName: doc.documentName,
  };
}

/**
 * Verifies or rejects an employee document (HR review workflow).
 */
export async function verifyEmployeeDocument(
  session: SessionContext,
  documentId: string,
  input: VerifyDocumentInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const hasPerm =
    session.isSuperAdmin ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes("documents.verify") ||
    session.effectivePermissions.includes("documents.manage");

  if (!hasPerm) {
    throw new Error("UNAUTHORIZED: Insufficient permissions to verify or reject employee documents.");
  }

  const docRows = await db
    .select()
    .from(employeeDocuments)
    .where(eq(employeeDocuments.id, documentId))
    .limit(1);

  if (docRows.length === 0) {
    throw new Error("DOCUMENT_NOT_FOUND: Document record not found.");
  }

  const doc = docRows[0];
  await verifyDocumentScopeAccess(session, doc.employeeId, "documents.verify");

  if (input.status === "REJECTED" && (!input.rejectionReason || input.rejectionReason.trim().length === 0)) {
    throw new Error("REJECTION_REASON_REQUIRED: A rejection reason must be provided when rejecting a document.");
  }

  const now = Date.now();
  await db
    .update(employeeDocuments)
    .set({
      verificationStatus: input.status,
      verifiedByUserId: session.userId,
      verifiedAt: now,
      rejectionReason: input.status === "REJECTED" ? input.rejectionReason?.trim() : null,
      updatedAt: now,
    })
    .where(eq(employeeDocuments.id, doc.id));

  // Audit logging
  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: input.status === "VERIFIED" ? "DOCUMENT_VERIFIED" : "DOCUMENT_REJECTED",
    targetEntity: "employee_documents",
    targetId: doc.id,
    changes: {
      previousStatus: doc.verificationStatus,
      newStatus: input.status,
      rejectionReason: input.rejectionReason || null,
      verifiedAt: now,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    id: doc.id,
    verificationStatus: input.status,
    verifiedByUserId: session.userId,
    verifiedAt: now,
    rejectionReason: input.status === "REJECTED" ? input.rejectionReason : null,
  };
}

/**
 * Deletes or archives a document.
 */
export async function deleteEmployeeDocument(
  session: SessionContext,
  documentId: string,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const docRows = await db
    .select()
    .from(employeeDocuments)
    .where(eq(employeeDocuments.id, documentId))
    .limit(1);

  if (docRows.length === 0) {
    throw new Error("DOCUMENT_NOT_FOUND: Document record not found.");
  }

  const doc = docRows[0];
  await verifyDocumentScopeAccess(session, doc.employeeId, "documents.manage");

  const now = Date.now();
  await db
    .update(employeeDocuments)
    .set({
      status: "ARCHIVED",
      updatedAt: now,
    })
    .where(eq(employeeDocuments.id, doc.id));

  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "DOCUMENT_DELETED",
    targetEntity: "employee_documents",
    targetId: doc.id,
    changes: {
      documentName: doc.documentName,
      documentType: doc.documentType,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return { success: true };
}

