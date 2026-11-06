/**
 * Standalone Encryption Configuration Validator
 * Pure TypeScript with ZERO node:crypto dependencies so it can be safely evaluated
 * in any runtime (Node.js, Edge, Instrumentation, and CI scripts) without Webpack chunk issues.
 */

// Auto-load .env file if running via standalone Node/CLI scripts (Node 20.6+)
if (typeof process !== "undefined" && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore error if .env doesn't exist
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

