import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export interface StoredFile {
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
}

export interface StorageProvider {
  save(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile>;
  getStream(storageKey: string): Promise<{ buffer: Buffer; mimeType: string }>;
  delete(storageKey: string): Promise<void>;
  generateDownloadToken(documentId: string, userId: string, ttlSeconds?: number): string;
  verifyDownloadToken(token: string): { valid: boolean; documentId?: string; userId?: string };
}

// In-memory or file-backed download tokens map with TTL
interface DownloadTokenPayload {
  documentId: string;
  userId: string;
  expiresAt: number;
}

const activeDownloadTokens = new Map<string, DownloadTokenPayload>();

// Storage root directory
const STORAGE_ROOT = path.join(process.cwd(), ".storage", "documents");

// Magic byte definitions for supported secure document types
const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }> = {
  "application/pdf": { bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  "image/png": { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }, // .PNG\r\n\x1a\n
  "image/jpeg": { bytes: [0xff, 0xd8, 0xff] }, // JPEG SOI marker
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    bytes: [0x50, 0x4b, 0x03, 0x04], // PK.. (ZIP archive header)
  },
};

/**
 * Validates document buffer against known magic byte signatures.
 * Returns true if the buffer matches the expected MIME signature.
 */
export function validateMagicBytes(buffer: Buffer, declaredMimeType: string): boolean {
  const rule = MAGIC_BYTES[declaredMimeType];
  if (!rule) {
    return false;
  }

  const offset = rule.offset || 0;
  if (buffer.length < offset + rule.bytes.length) {
    return false;
  }

  for (let i = 0; i < rule.bytes.length; i++) {
    if (buffer[offset + i] !== rule.bytes[i]) {
      return false;
    }
  }

  return true;
}

class LocalPrivateStorageProvider implements StorageProvider {
  private initialized = false;

  private async ensureStorageDir() {
    if (!this.initialized) {
      await fs.mkdir(STORAGE_ROOT, { recursive: true });
      this.initialized = true;
    }
  }

  async save(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile> {
    await this.ensureStorageDir();

    // 1. Validate magic bytes
    if (!validateMagicBytes(buffer, mimeType)) {
      throw new Error(`INVALID_FILE_SIGNATURE: File contents do not match declared MIME type ${mimeType}.`);
    }

    // 2. Compute SHA-256 hash for deduplication and tamper detection
    const sha256Hash = crypto.createHash("sha256").update(buffer).digest("hex");

    // 3. Generate secure random storage key (UUID + clean extension)
    const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "") || ".bin";
    const storageKey = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(STORAGE_ROOT, storageKey);

    // 4. Write to private filesystem storage with restrictive permissions
    await fs.writeFile(filePath, buffer, { mode: 0o600 });

    return {
      storageKey,
      originalName: path.basename(originalName),
      mimeType,
      sizeBytes: buffer.length,
      sha256Hash,
    };
  }

  async getStream(storageKey: string): Promise<{ buffer: Buffer; mimeType: string }> {
    await this.ensureStorageDir();

    // Sanitize key to prevent path traversal
    const safeKey = path.basename(storageKey);
    const filePath = path.join(STORAGE_ROOT, safeKey);

    try {
      const buffer = await fs.readFile(filePath);
      // Determine MIME from extension or default
      const ext = path.extname(safeKey).toLowerCase();
      let mimeType = "application/octet-stream";
      if (ext === ".pdf") mimeType = "application/pdf";
      else if (ext === ".png") mimeType = "image/png";
      else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
      else if (ext === ".docx")
        mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      return { buffer, mimeType };
    } catch {
      throw new Error(`FILE_NOT_FOUND: Storage key ${safeKey} could not be retrieved from private vault.`);
    }
  }

  async delete(storageKey: string): Promise<void> {
    await this.ensureStorageDir();
    const safeKey = path.basename(storageKey);
    const filePath = path.join(STORAGE_ROOT, safeKey);
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  generateDownloadToken(documentId: string, userId: string, ttlSeconds = 900): string {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + ttlSeconds * 1000;
    activeDownloadTokens.set(token, {
      documentId,
      userId,
      expiresAt,
    });
    return token;
  }

  verifyDownloadToken(token: string): { valid: boolean; documentId?: string; userId?: string } {
    const payload = activeDownloadTokens.get(token);
    if (!payload) {
      return { valid: false };
    }

    if (Date.now() > payload.expiresAt) {
      activeDownloadTokens.delete(token);
      return { valid: false };
    }

    return {
      valid: true,
      documentId: payload.documentId,
      userId: payload.userId,
    };
  }
}

export const documentStorage: StorageProvider = new LocalPrivateStorageProvider();

