import { describe, it, expect, beforeEach } from "vitest";
import { seedDatabase } from "../src/lib/db/seed";
import { db } from "../src/lib/db/client";
import { employeeDocuments, auditLogs } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  uploadEmployeeDocument,
  getEmployeeDocuments,
  createDocumentDownloadToken,
  getDocumentStream,
  verifyEmployeeDocument,
  deleteEmployeeDocument,
} from "../src/lib/documents/service";
import { validateMagicBytes, documentStorage } from "../src/lib/storage";
import { SessionContext } from "../src/lib/permissions/types";

describe("Phase 2C — Employee Documents & Private Vault Engine", () => {
  const adminSession: SessionContext = {
    userId: "usr_admin",
    employeeId: "EMP-002",
    name: "Aakash Admin",
    email: "admin@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["ADMIN"],
    effectivePermissions: [
      "portal.admin.access",
      "documents.view",
      "documents.upload",
      "documents.manage",
      "documents.verify",
    ],
    widestScope: "ORGANIZATION",
    managedDepartmentIds: [],
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: false,
  };

  const hrManagerSession: SessionContext = {
    userId: "usr_hrmanager",
    employeeId: "EMP-003",
    name: "Meera HR-Manager",
    email: "hrmanager@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["HR_MANAGER"],
    effectivePermissions: [
      "portal.admin.access",
      "documents.view",
      "documents.upload",
      "documents.verify",
    ],
    widestScope: "ORGANIZATION",
    managedDepartmentIds: [],
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: false,
  };

  const employeeSession: SessionContext = {
    userId: "usr_employee",
    employeeId: "EMP-006",
    name: "Rohan Employee",
    email: "employee@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["EMPLOYEE"],
    effectivePermissions: ["portal.employee.access", "documents.view", "documents.upload"],
    widestScope: "SELF",
    managedDepartmentIds: [],
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: false,
  };

  const deptScopedSession: SessionContext = {
    userId: "usr_hrexecutive",
    employeeId: "EMP-004",
    name: "Kavita HR-Executive",
    email: "hrexecutive@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["HR_EXECUTIVE"],
    effectivePermissions: ["portal.admin.access", "documents.view"],
    widestScope: "DEPARTMENT",
    managedDepartmentIds: ["dept_hr"], // Managed: HR department only
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: false,
  };

  // Valid PDF buffer: starts with %PDF-1.4
  const validPdfBuffer = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
  // Valid PNG buffer: starts with \x89PNG\r\n\x1a\n
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  // Corrupt / spoofed buffer: plain text pretending to be PDF
  const spoofedBuffer = Buffer.from("THIS IS PLAIN TEXT EXECUTABLE OR SHELL SCRIPT");

  beforeEach(async () => {
    process.env.PAYROLL_ACTIVE_KEY_VERSION = "v1";
    process.env.PAYROLL_ENCRYPTION_KEY_V1 = "16653300a8f4b5fd31651ab5e712f66368283ea90db280042d10f382ec4af16a";
    process.env.PAYROLL_ENCRYPTION_KEY_V2 = "54abd47926e62762db1c45bac2259cd138430a1214b9d6bc2bc370512e0956e8";
    await seedDatabase();
  });

  describe("File Validation & Magic Bytes", () => {
    it("should accept valid PDF magic byte signatures", () => {
      expect(validateMagicBytes(validPdfBuffer, "application/pdf")).toBe(true);
    });

    it("should accept valid PNG magic byte signatures", () => {
      expect(validateMagicBytes(validPngBuffer, "image/png")).toBe(true);
    });

    it("should reject files with spoofed or mismatched MIME types", () => {
      expect(validateMagicBytes(spoofedBuffer, "application/pdf")).toBe(false);
      expect(validateMagicBytes(validPdfBuffer, "image/png")).toBe(false);
    });

    it("should reject uploads with spoofed magic bytes", async () => {
      await expect(
        uploadEmployeeDocument(adminSession, "EMP-004", {
          documentType: "AADHAAR_ID",
          documentName: "fake_id.pdf",
          buffer: spoofedBuffer,
          mimeType: "application/pdf",
        })
      ).rejects.toThrow(/INVALID_FILE_SIGNATURE/);
    });
  });

  describe("Document Upload & Version History", () => {
    it("should upload valid document, store encrypted path, and compute SHA-256 hash", async () => {
      const doc = await uploadEmployeeDocument(adminSession, "EMP-004", {
        documentType: "AADHAAR_ID",
        documentName: "aadhaar_card.pdf",
        buffer: validPdfBuffer,
        mimeType: "application/pdf",
      });

      expect(doc.id).toBeDefined();
      expect(doc.version).toBe(1);
      expect(doc.fileHash).toBeDefined();
      expect(doc.verificationStatus).toBe("PENDING");

      // Verify record stored in Turso
      const stored = await db.select().from(employeeDocuments).where(eq(employeeDocuments.id, doc.id));
      expect(stored.length).toBe(1);
      expect(stored[0].storagePathEncrypted.startsWith("v1:")).toBe(true);

      // Verify audit event
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.targetId, doc.id));
      expect(logs.some((l) => l.action === "DOCUMENT_UPLOADED")).toBe(true);
    });

    it("should support version replacement, incrementing version and archiving previous document", async () => {
      // 1. Upload initial version (v1)
      const v1Doc = await uploadEmployeeDocument(adminSession, "EMP-004", {
        documentType: "APPOINTMENT_LETTER",
        documentName: "offer_letter_v1.pdf",
        buffer: validPdfBuffer,
        mimeType: "application/pdf",
      });
      expect(v1Doc.version).toBe(1);

      // 2. Upload replacement version (v2)
      const v2Doc = await uploadEmployeeDocument(adminSession, "EMP-004", {
        documentType: "APPOINTMENT_LETTER",
        documentName: "offer_letter_revised.pdf",
        buffer: validPdfBuffer,
        mimeType: "application/pdf",
        replacesDocumentId: v1Doc.id,
      });

      expect(v2Doc.version).toBe(2);

      // Verify previous version status was changed to ARCHIVED
      const prevDoc = await db.select().from(employeeDocuments).where(eq(employeeDocuments.id, v1Doc.id));
      expect(prevDoc[0].status).toBe("ARCHIVED");

      // Active list should only return v2 by default
      const activeDocs = await getEmployeeDocuments(adminSession, "EMP-004", false);
      expect(activeDocs.some((d) => d.id === v2Doc.id)).toBe(true);
      expect(activeDocs.some((d) => d.id === v1Doc.id)).toBe(false);

      // includeArchived should return both
      const allDocs = await getEmployeeDocuments(adminSession, "EMP-004", true);
      expect(allDocs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Download Tokens & Streaming", () => {
    it("should generate a short-lived download token and successfully stream the document", async () => {
      const doc = await uploadEmployeeDocument(adminSession, "EMP-004", {
        documentType: "PAN_TAX_ID",
        documentName: "pan_card.png",
        buffer: validPngBuffer,
        mimeType: "image/png",
      });

      const { token, expiresInSeconds } = await createDocumentDownloadToken(adminSession, doc.id);
      expect(token).toBeDefined();
      expect(expiresInSeconds).toBe(900);

      // Stream document using valid token
      const file = await getDocumentStream(null, doc.id, token);
      expect(file.mimeType).toBe("image/png");
      expect(file.fileName).toBe("pan_card.png");
      expect(file.buffer.length).toBe(validPngBuffer.length);
    });

    it("should reject expired or invalid download tokens", async () => {
      const doc = await uploadEmployeeDocument(adminSession, "EMP-004", {
        documentType: "PAN_TAX_ID",
        documentName: "pan_card.png",
        buffer: validPngBuffer,
        mimeType: "image/png",
      });

      await expect(getDocumentStream(null, doc.id, "completely_fake_invalid_token")).rejects.toThrow(
        /INVALID_DOWNLOAD_TOKEN/
      );
    });
  });

  describe("HR Verification Workflow", () => {
    it("should allow HR to verify an employee document", async () => {
      const doc = await uploadEmployeeDocument(adminSession, "EMP-004", {
        documentType: "ADDRESS_PROOF",
        documentName: "address_proof.pdf",
        buffer: validPdfBuffer,
        mimeType: "application/pdf",
      });

      const verified = await verifyEmployeeDocument(hrManagerSession, doc.id, {
        status: "VERIFIED",
      });

      expect(verified.verificationStatus).toBe("VERIFIED");
      expect(verified.verifiedByUserId).toBe("usr_hrmanager");

      // Verify database update
      const stored = await db.select().from(employeeDocuments).where(eq(employeeDocuments.id, doc.id));
      expect(stored[0].verificationStatus).toBe("VERIFIED");
      expect(stored[0].verifiedByUserId).toBe("usr_hrmanager");
    });

    it("should require a rejection reason when rejecting a document", async () => {
      const doc = await uploadEmployeeDocument(adminSession, "EMP-004", {
        documentType: "ADDRESS_PROOF",
        documentName: "address_proof.pdf",
        buffer: validPdfBuffer,
        mimeType: "application/pdf",
      });

      await expect(
        verifyEmployeeDocument(hrManagerSession, doc.id, {
          status: "REJECTED",
          rejectionReason: "   ",
        })
      ).rejects.toThrow(/REJECTION_REASON_REQUIRED/);

      const rejected = await verifyEmployeeDocument(hrManagerSession, doc.id, {
        status: "REJECTED",
        rejectionReason: "Document is illegible and missing official stamp.",
      });

      expect(rejected.verificationStatus).toBe("REJECTED");
      expect(rejected.rejectionReason).toBe("Document is illegible and missing official stamp.");
    });
  });

  describe("Scope & Permission Enforcement", () => {
    it("should allow employee to upload and view their own documents under SELF scope", async () => {
      const doc = await uploadEmployeeDocument(employeeSession, "EMP-006", {
        documentType: "OTHER_HR_DOCUMENT",
        documentName: "my_cert.pdf",
        buffer: validPdfBuffer,
        mimeType: "application/pdf",
      });

      expect(doc.id).toBeDefined();

      const myDocs = await getEmployeeDocuments(employeeSession, "EMP-006");
      expect(myDocs.some((d) => d.id === doc.id)).toBe(true);
    });

    it("should prevent employee under SELF scope from accessing other employees documents", async () => {
      await expect(getEmployeeDocuments(employeeSession, "EMP-004")).rejects.toThrow(/SCOPE_VIOLATION/);
    });

    it("should prevent HR_EXECUTIVE with DEPARTMENT scope from accessing employees in other departments", async () => {
      // EMP-006 is in Engineering (dept_eng), whereas Kavita is only permitted for dept_hr
      await expect(getEmployeeDocuments(deptScopedSession, "EMP-006")).rejects.toThrow(/SCOPE_VIOLATION/);
    });
  });
});

