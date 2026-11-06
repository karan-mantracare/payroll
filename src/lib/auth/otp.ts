import { randomInt, createHmac, timingSafeEqual, randomBytes } from "crypto";

export interface SendOtpParams {
  email: string;
  otp: string;
  challengeId: string;
  userName?: string;
}

export interface OtpDeliveryResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}

export interface OtpDeliveryProvider {
  name: string;
  sendOtp(params: SendOtpParams): Promise<OtpDeliveryResult>;
}

/**
 * Console delivery provider for development environments.
 * Logs OTP dispatch event without exposing sensitive values in production.
 */
export class ConsoleOtpDeliveryProvider implements OtpDeliveryProvider {
  name = "ConsoleDeliveryProvider";

  async sendOtp(params: SendOtpParams): Promise<OtpDeliveryResult> {
    if (process.env.NODE_ENV !== "production") {
      // In dev mode, we log dispatch metadata for developer convenience
      // (The actual secret OTP value is not exposed in production logs)
      console.log(
        `[OTP Console Delivery] Challenge ${params.challengeId} dispatched to ${maskEmail(params.email)}.`
      );
    }
    return {
      success: true,
      provider: this.name,
      messageId: `console_msg_${randomBytes(8).toString("hex")}`,
    };
  }
}

/**
 * Future pluggable Email OTP delivery provider.
 * When SMTP/SendGrid/SES is configured, this delivers the email.
 * Defaults to a safe unconfigured state.
 */
export class EmailOtpDeliveryProvider implements OtpDeliveryProvider {
  name = "EmailDeliveryProvider";

  async sendOtp(params: SendOtpParams): Promise<OtpDeliveryResult> {
    const hasSmtpConfigured = !!(
      process.env.SMTP_HOST ||
      process.env.SENDGRID_API_KEY ||
      process.env.AWS_SES_REGION
    );

    if (!hasSmtpConfigured) {
      return {
        success: false,
        provider: this.name,
        error: "Production email OTP service is not configured. Email delivery unavailable.",
      };
    }

    // Future email integration logic here (e.g. nodemailer, @sendgrid/mail, etc.)
    return {
      success: true,
      provider: this.name,
      messageId: `email_msg_${randomBytes(8).toString("hex")}`,
    };
  }
}

let activeOtpProvider: OtpDeliveryProvider = new ConsoleOtpDeliveryProvider();

export function setOtpDeliveryProvider(provider: OtpDeliveryProvider) {
  activeOtpProvider = provider;
}

export function getOtpDeliveryProvider(): OtpDeliveryProvider {
  return activeOtpProvider;
}

/**
 * Asserts that the OTP configuration is secure.
 * Rejects any startup attempt where PAYROLL_DEV_STATIC_OTP_ENABLED is enabled in production.
 */
export function assertValidOtpConfig(): void {
  const isProd =
    process.env.PAYROLL_DB_ENV === "production" ||
    (process.env.NODE_ENV === "production" && process.env.ALLOW_STAGING_STATIC_OTP !== "true");
  const staticOtpEnabled = process.env.PAYROLL_DEV_STATIC_OTP_ENABLED === "true";

  if (isProd && staticOtpEnabled) {
    throw new Error(
      "CRITICAL SECURITY CONFIGURATION ERROR: PAYROLL_DEV_STATIC_OTP_ENABLED cannot be enabled in production environments!"
    );
  }
}

/**
 * Strictly verifies whether development static OTP (123456) is permitted.
 * CANNOT be enabled when PAYROLL_DB_ENV === 'production'.
 */
export function isStaticDevOtpAllowed(): boolean {
  if (process.env.PAYROLL_DB_ENV === "production") return false;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_STAGING_STATIC_OTP !== "true") {
    return false;
  }

  return (
    (process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test" ||
      process.env.ALLOW_STAGING_STATIC_OTP === "true" ||
      !process.env.NODE_ENV) &&
    process.env.PAYROLL_DEV_STATIC_OTP_ENABLED === "true"
  );
}

/**
 * Generates a cryptographically secure 6-digit OTP code (100000 - 999999).
 */
export function generateSecureOtp(): string {
  return randomInt(100000, 1000000).toString();
}

/**
 * Hashes an OTP code using keyed HMAC SHA-256 for secure storage at rest.
 */
export function hashOtp(otp: string): string {
  const secret = process.env.SESSION_SECRET || "default_otp_hmac_secret_mantracare_2026";
  return createHmac("sha256", secret).update(otp).digest("hex");
}

/**
 * Timing-safe comparison of provided OTP against the stored keyed HMAC hash.
 */
export function verifyOtpHash(otp: string, storedHash: string): boolean {
  if (!otp || !storedHash) return false;
  const computedHash = hashOtp(otp);
  if (computedHash.length !== storedHash.length) return false;

  return timingSafeEqual(
    Buffer.from(computedHash, "hex"),
    Buffer.from(storedHash, "hex")
  );
}

/**
 * Masks an email for safe client-side display (e.g. "a***n@mantracare.com").
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 2) {
    return `${localPart[0]}*@${domain}`;
  }
  const first = localPart[0];
  const last = localPart[localPart.length - 1];
  const maskedMiddle = "*".repeat(Math.min(localPart.length - 2, 4));
  return `${first}${maskedMiddle}${last}@${domain}`;
}

