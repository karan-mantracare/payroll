import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Auto-load .env file if running via standalone Node/CLI scripts (Node 20.6+)
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore error if .env doesn't exist (e.g. in container with system env vars)
  }
}

/**
 * Validates whether a given string is a valid 64-character hexadecimal key (32 bytes = 256 bits).
 */
export function isValidKeyHex(keyHex: unknown): keyHex is string {
  if (typeof keyHex !== "string") return false;
  const trimmed = keyHex.trim();
  return trimmed.length === 64 && /^[0-9a-fA-F]{64}$/.test(trimmed);
}

/**
 * Resolves the active encryption key version from environment variables.
 * Defaults to "v1" if unspecified, but fails validation if the corresponding key is missing.
 */
export function getActiveKeyVersion(): string {
  const version = process.env.PAYROLL_ACTIVE_KEY_VERSION?.trim();
  return version && /^v[0-9]+$/i.test(version) ? version.toLowerCase() : "v1";
}

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

export interface EncryptionValidationResult {
  isValid: boolean;
  activeVersion: string;
  configuredVersions: string[];
  errors: string[];
}

/**
 * Validates the entire encryption configuration.
 * Used during server startup (instrumentation), health checks, and CI verification.
 */
export function validateEncryptionConfig(): EncryptionValidationResult {
  const errors: string[] = [];
  const activeVersion = getActiveKeyVersion();
  const configuredVersions: string[] = [];

  // 1. Scan environment for all PAYROLL_ENCRYPTION_KEY_V* variables
  const keyEnvRegex = /^PAYROLL_ENCRYPTION_KEY_(V[0-9]+)$/i;
  for (const [envKey, envVal] of Object.entries(process.env)) {
    const match = envKey.match(keyEnvRegex);
    if (match && envVal) {
      const ver = match[1].toLowerCase();
      configuredVersions.push(ver);
      if (!isValidKeyHex(envVal)) {
        errors.push(
          `Environment variable "${envKey}" must be a 64-character hexadecimal string (32 bytes). Found invalid length or format.`
        );
      }
    }
  }

  // 2. Validate active version key is present and configured
  const activeEnvVar = `PAYROLL_ENCRYPTION_KEY_${activeVersion.toUpperCase()}`;
  const activeKeyRaw = process.env[activeEnvVar]?.trim();

  if (!activeKeyRaw) {
    errors.push(
      `Active encryption key is missing. PAYROLL_ACTIVE_KEY_VERSION="${activeVersion}" requires environment variable "${activeEnvVar}" to be set.`
    );
  } else if (!isValidKeyHex(activeKeyRaw)) {
    // Error already added above if matched, but ensure it's logged
    if (!errors.some((e) => e.includes(activeEnvVar))) {
      errors.push(`Active encryption key "${activeEnvVar}" is not a valid 64-character hexadecimal string.`);
    }
  }

  return {
    isValid: errors.length === 0,
    activeVersion,
    configuredVersions: Array.from(new Set(configuredVersions)).sort(),
    errors,
  };
}

/**
 * Asserts that encryption keys are ready and valid.
 * Throws a fatal Error if any configuration check fails.
 */
export function assertEncryptionReady(): void {
  const result = validateEncryptionConfig();
  if (!result.isValid) {
    throw new Error(
      `Fatal Encryption Startup Error:\n${result.errors.map((e) => `  - ${e}`).join("\n")}`
    );
  }
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
