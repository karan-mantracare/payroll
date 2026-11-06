import { randomBytes } from "crypto";

export interface SafeErrorDetails {
  correlationId: string;
  timestamp: string;
  context: string;
  code: string;
  safeMessage: string;
}

const SENSITIVE_KEY_REGEX =
  /password|hash|token|otp|secret|cookie|auth|salary|bank|tax|pan|aadhaar|ssn|credit|credential|compensation|bonus|allowance|email|phone|mobile|national_id/i;

/**
 * Generates a unique, cryptographically secure correlation ID for request tracking.
 */
export function generateCorrelationId(prefix = "req"): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

/**
 * Deeply redacts sensitive keys and values from objects, arrays, and error strings
 * to strictly prevent PII, passwords, OTPs, SQL parameter values, or confidential
 * employee information from leaking through exception messages or stack traces.
 */
export function redactSensitiveData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    let cleaned = data;

    // 1. Redact SQL parameters and arguments
    cleaned = cleaned.replace(/params:\s*\[?[^\]\n]+\]?/gi, "params: [REDACTED]");
    cleaned = cleaned.replace(/args:\s*\[?[^\]\n]+\]?/gi, "args: [REDACTED]");
    cleaned = cleaned.replace(/values\s*\([^)]+\)/gi, "values ([REDACTED])");

    // 2. Redact bcrypt password hashes
    cleaned = cleaned.replace(/\$2[abxy]\$\d{1,2}\$[A-Za-z0-9./]{20,60}/g, "$2b$12$[REDACTED_BCRYPT]");

    // 3. Redact Hex tokens and Challenge IDs
    cleaned = cleaned.replace(/otp_[a-f0-9]{16,64}/gi, "otp_[REDACTED]");
    cleaned = cleaned.replace(/usr_[a-f0-9]{16,64}/gi, "usr_[REDACTED]");
    cleaned = cleaned.replace(/sess_[a-f0-9]{16,64}/gi, "sess_[REDACTED]");
    cleaned = cleaned.replace(/reset_[a-f0-9]{16,64}/gi, "reset_[REDACTED]");
    cleaned = cleaned.replace(/\b[a-f0-9]{32,64}\b/gi, "[REDACTED_TOKEN_HEX]");

    // 4. Redact Bearer tokens & cookies
    cleaned = cleaned.replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, "Bearer [REDACTED]");
    cleaned = cleaned.replace(/mc_payroll_session=[^;\s]+/gi, "mc_payroll_session=[REDACTED]");
    cleaned = cleaned.replace(/cookie[s]?\s*[:=]\s*[^;\s\n]+/gi, "cookie: [REDACTED]");

    // 5. Redact 6-digit OTP codes
    cleaned = cleaned.replace(/\b\d{6}\b/g, "[REDACTED_OTP]");

    // 6. Redact Email addresses
    cleaned = cleaned.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED_EMAIL]");

    // 7. Redact National IDs (PAN, Aadhaar, SSN) and Indian phone numbers
    cleaned = cleaned.replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, "[REDACTED_PAN]");
    cleaned = cleaned.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "[REDACTED_AADHAAR]");
    cleaned = cleaned.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]");
    cleaned = cleaned.replace(/\b(?:\+91[-\s]?)?[6-9]\d{9}\b/g, "[REDACTED_PHONE]");

    // 8. Redact query string credentials
    cleaned = cleaned.replace(/password=[^&\s]+/gi, "password=[REDACTED]");

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
 * Strictly allowlisted safe user-facing messages.
 * Any message not explicitly allowlisted is rejected and replaced by a safe fallback.
 */
const EXACT_SAFE_USER_MESSAGES = new Set([
  "Please enter your work email and password.",
  "Please enter both your work email and password.",
  "Invalid work email or password.",
  "Invalid email or password.",
  "Account temporarily locked due to multiple failed attempts. Please try again later.",
  "Account is deactivated. Please contact your HR administrator.",
  "Employee record is inactive. Please contact HR administration.",
  "Verification token and code are required.",
  "Invalid verification code.",
  "Verification code has expired. Please request a new code.",
  "Maximum verification attempts exceeded. Please initiate sign-in again.",
  "Password reset link is invalid or has expired.",
  "Password reset token has expired. Please submit a new request.",
  "Password reset instructions have been dispatched if the email exists in our records.",
  "Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and symbols.",
  "New password cannot be the same as the current password.",
  "Passwords do not match.",
  "Please enter your email to receive password reset instructions.",
  "Session verification timed out. Please check your connection or retry.",
  "Your session has expired. Please sign in again.",
  "Access denied. Insufficient permissions.",
  "Your account does not have authorization to access this service.",
  "Unable to complete sign-in right now. Please try again.",
  "Unable to complete verification at this time. Please try again.",
]);

/**
 * Safe parameterized patterns for dynamic user-facing messages.
 */
const SAFE_USER_MESSAGE_PATTERNS = [
  /^Invalid verification code\. \d+ attempts? remaining\.?$/i,
  /^Password must be at least \d+ characters.*$/i,
  /^Account temporarily locked.*$/i,
];

/**
 * Disallowed patterns that must NEVER pass to end users under any circumstance.
 */
const SYSTEM_CONTAMINATION_PATTERNS = [
  /failed query/i,
  /insert into/i,
  /select /i,
  /update /i,
  /delete from/i,
  /sqlite/i,
  /drizzle/i,
  /libsql/i,
  /turso/i,
  /table /i,
  /column /i,
  /pragma/i,
  /syntax error/i,
  /constraint/i,
  /foreign key/i,
  /params:/i,
  /args:/i,
  /stack trace/i,
  /\bat\s+(?:async\s+)?[a-zA-Z0-9_$.<>[\]]+\s+\(/i,
  /\.ts:\d+/i,
  /\.js:\d+/i,
  /error:/i,
  /exception/i,
];

/**
 * Sanitizes technical error messages using a strict allowlist.
 * Never returns unknown raw exception messages or technical errors to users.
 */
export function sanitizeUserFacingError(
  rawError?: unknown,
  fallback = "Unable to complete sign-in right now. Please try again."
): string {
  if (!rawError || typeof rawError !== "string") {
    return fallback;
  }

  const trimmed = rawError.trim();

  // 1. Immediately reject anything containing technical / system fragments
  if (SYSTEM_CONTAMINATION_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return fallback;
  }

  // 2. Allow exact safe messages
  if (EXACT_SAFE_USER_MESSAGES.has(trimmed)) {
    return trimmed;
  }

  // 3. Allow verified safe parameterized patterns
  if (SAFE_USER_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return trimmed;
  }

  // 4. Default to safe fallback for ANY unallowlisted message
  return fallback;
}

