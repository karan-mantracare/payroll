import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Default dev key (32 bytes = 256 bits). In production, set via PAYROLL_ENCRYPTION_KEY_V1
const DEFAULT_DEV_KEY_V1 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const DEFAULT_DEV_KEY_V2 = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

export const KEY_STORE: Record<string, Buffer> = {
  v1: Buffer.from(process.env.PAYROLL_ENCRYPTION_KEY_V1 || DEFAULT_DEV_KEY_V1, "hex"),
  v2: Buffer.from(process.env.PAYROLL_ENCRYPTION_KEY_V2 || DEFAULT_DEV_KEY_V2, "hex"),
};

export const ACTIVE_KEY_VERSION = process.env.PAYROLL_ACTIVE_KEY_VERSION || "v1";

export interface EncryptedEnvelope {
  version: string;
  iv: string;
  tag: string;
  ciphertext: string;
  serialized: string; // format: "version:iv:tag:ciphertext"
}

/**
 * Encrypts sensitive text using AES-256-GCM with authenticated tags.
 */
export function encryptField(plainText: string | number, keyVersion = ACTIVE_KEY_VERSION): string {
  const key = KEY_STORE[keyVersion];
  if (!key || key.length !== 32) {
    throw new Error(`Invalid or missing encryption key for version ${keyVersion}. Must be 32 bytes (256-bit).`);
  }

  const iv = randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const textToEncrypt = String(plainText);
  let encrypted = cipher.update(textToEncrypt, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag().toString("hex");
  const ivHex = iv.toString("hex");

  return `${keyVersion}:${ivHex}:${tag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM envelope payload.
 * Verifies authenticity via the GCM auth tag. Throws if tampered.
 */
export function decryptField(envelopeString: string): string {
  if (!envelopeString || typeof envelopeString !== "string") {
    throw new Error("Invalid encrypted envelope string");
  }

  const parts = envelopeString.split(":");
  if (parts.length !== 4) {
    throw new Error("Malformed encrypted envelope format. Expected version:iv:tag:ciphertext");
  }

  const [version, ivHex, tagHex, ciphertextHex] = parts;
  const key = KEY_STORE[version];
  if (!key) {
    throw new Error(`Unknown encryption key version: ${version}`);
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Rotates an encrypted field from its current key version to a target key version.
 */
export function rotateField(envelopeString: string, targetVersion = ACTIVE_KEY_VERSION): string {
  const decrypted = decryptField(envelopeString);
  return encryptField(decrypted, targetVersion);
}
