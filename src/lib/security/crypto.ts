import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Auto-load .env file if running via standalone Node/CLI scripts (Node 20.6+)
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore error if .env doesn't exist (e.g. in container with system env vars)
  }
}

export {
  isValidKeyHex,
  getActiveKeyVersion,
  validateEncryptionConfig,
  assertEncryptionReady,
  type EncryptionValidationResult,
} from "./config-validator";
import { isValidKeyHex, getActiveKeyVersion } from "./config-validator";

/**
 * Resolves and validates an encryption key for a given version.
 * ZERO HARDCODED FALLBACK KEYS: Throws immediately if key is missing or invalid.
 */
export function getKey(version: string): Buffer {
  const normalizedVersion = version.toLowerCase().trim();
  const envVarName = `PAYROLL_ENCRYPTION_KEY_${normalizedVersion.toUpperCase()}`;
  const rawKey = process.env[envVarName]?.trim();

  if (!rawKey) {
    throw new Error(
      `CRITICAL SECURITY CONFIGURATION ERROR: Missing encryption key for version "${normalizedVersion}". ` +
      `Ensure environment variable "${envVarName}" is set with a 64-character hex string (32 bytes). ` +
      `Older keys must remain configured in environment variables to prevent permanent data loss.`
    );
  }

  if (rawKey.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    throw new Error(
      `CRITICAL SECURITY CONFIGURATION ERROR: Invalid encryption key format for version "${normalizedVersion}". ` +
      `Key must be exactly 64 hexadecimal characters (256-bit / 32 bytes). Found length: ${rawKey.length}.`
    );
  }

  return Buffer.from(rawKey, "hex");
}


/**
 * Encrypts sensitive text using AES-256-GCM with authenticated tags.
 * Output format: "version:ivHex:authTagHex:ciphertextHex"
 */
export function encryptField(plainText: string | number, keyVersion = getActiveKeyVersion()): string {
  const normalizedVersion = keyVersion.toLowerCase().trim();
  const key = getKey(normalizedVersion);

  const iv = randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const textToEncrypt = String(plainText);
  let encrypted = cipher.update(textToEncrypt, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag().toString("hex");
  const ivHex = iv.toString("hex");

  return `${normalizedVersion}:${ivHex}:${tag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM envelope payload.
 * Verifies authenticity via the GCM auth tag. Throws if tampered or key missing.
 */
export function decryptField(envelopeString: string): string {
  if (!envelopeString || typeof envelopeString !== "string") {
    throw new Error("Invalid encrypted envelope string: string must be non-empty.");
  }

  const parts = envelopeString.split(":");
  if (parts.length !== 4) {
    throw new Error("Malformed encrypted envelope format. Expected version:iv:tag:ciphertext");
  }

  const [version, ivHex, tagHex, ciphertextHex] = parts;
  const key = getKey(version);

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
export function rotateField(envelopeString: string, targetVersion = getActiveKeyVersion()): string {
  const decrypted = decryptField(envelopeString);
  return encryptField(decrypted, targetVersion);
}
