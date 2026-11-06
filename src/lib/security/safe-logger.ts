import { randomBytes } from "crypto";

export interface SafeErrorDetails {
  correlationId: string;
  timestamp: string;
  context: string;
  code: string;
  safeMessage: string;
}

const SENSITIVE_KEY_REGEX = /password|hash|token|otp|secret|cookie|auth|salary|bank|tax|pan|aadhaar|ssn|credit|credential/i;

/**
 * Generates a unique, cryptographically secure correlation ID for request tracking.
 */
export function generateCorrelationId(prefix = "req"): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

/**
 * Deeply redacts sensitive keys and values from objects, arrays, and error strings
 * to strictly prevent PII, passwords, OTPs, or SQL parameter leaks in server logs.
 */
export function redactSensitiveData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    // Redact SQL parameter arrays and potential token/hash substrings
    let cleaned = data.replace(/params:\s*\[?[^\]\n]+\]?/gi, "params: [REDACTED]");
    cleaned = cleaned.replace(/otp_[a-f0-9]{16,64}/gi, "otp_[REDACTED]");
    cleaned = cleaned.replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, "Bearer [REDACTED]");
    return cleaned;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  if (typeof data === "object") {
    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        redacted[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        redacted[key] = redactSensitiveData(value);
      } else if (typeof value === "string") {
        redacted[key] = redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  return data;
}

/**
 * Securely logs an error to the server console with full PII redaction and a correlation ID.
 * Returns the correlation ID to include in sanitized user-facing responses.
 */
export function logSecureError(
  context: string,
  error: unknown,
  metadata?: Record<string, any>,
  existingCorrelationId?: string
): string {
  const correlationId = existingCorrelationId || generateCorrelationId();
  const timestamp = new Date().toISOString();

  let errorMessage = "Unknown error";
  let errorStack: string | undefined;

  if (error instanceof Error) {
    errorMessage = error.message;
    errorStack = error.stack;
  } else if (typeof error === "string") {
    errorMessage = error;
  }

  const redactedMessage = redactSensitiveData(errorMessage);
  const redactedMeta = metadata ? redactSensitiveData(metadata) : undefined;

  console.error(
    `[SECURE-LOG] [${timestamp}] [CID:${correlationId}] [${context}]`,
    JSON.stringify({
      error: redactedMessage,
      context,
      metadata: redactedMeta,
    })
  );

  if (process.env.NODE_ENV === "development" && errorStack) {
    // Print stack trace only in development, redacting sensitive query strings
    console.error(`[CID:${correlationId}] Stack:`, redactSensitiveData(errorStack));
  }

  return correlationId;
}

/**
 * Sanitizes technical error messages to safe user-facing copy.
 * Ensures zero database schemas, SQL statements, column names, or stack traces leak to the client.
 */
export function sanitizeUserFacingError(
  rawError?: unknown,
  fallback = "Unable to complete sign-in right now. Please try again."
): string {
  if (!rawError || typeof rawError !== "string") {
    return fallback;
  }

  const technicalPatterns = [
    /failed query/i,
    /insert into/i,
    /select /i,
    /update /i,
    /delete from/i,
    /sqlite_/i,
    /drizzle/i,
    /syntax error/i,
    /constraint/i,
    /foreign key/i,
    /table /i,
    /column /i,
    /params:/i,
    /at \w+/i,
    /stack trace/i,
    /libsql/i,
    /turso/i,
  ];

  if (technicalPatterns.some((pattern) => pattern.test(rawError))) {
    return fallback;
  }

  return rawError;
}

