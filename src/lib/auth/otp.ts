import { randomInt, createHmac, timingSafeEqual, randomBytes } from "crypto";

export interface SendOtpParams {
  email: string;
  otp: string;
  challengeId: string;
  userName?: string;
  expiryMinutes?: string;
  companyName?: string;
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
 * Console delivery provider for development/test environments.
 * Logs OTP dispatch event without exposing sensitive values in production.
 */
export class ConsoleOtpDeliveryProvider implements OtpDeliveryProvider {
  name = "ConsoleDeliveryProvider";

  async sendOtp(params: SendOtpParams): Promise<OtpDeliveryResult> {
    if (process.env.NODE_ENV !== "production") {
      // In dev mode, we log dispatch metadata for developer convenience
      console.log(
        `[OTP Console Delivery] Challenge ${params.challengeId} dispatched to ${maskEmail(params.email)}. (OTP: ${params.otp})`
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
 * MantraCare Notify API delivery provider for OTP emails.
 * Dispatches via POST https://api-notify.mantracare.com/api/v1/notifications/trigger
 * Authorization: Bearer <NOTIFY_EMAIL_TOKEN>
 *
 * Payload:
 * {
 *   "trigger": "OTP Email",
 *   "recipients": [ "<Employee Email>" ],
 *   "payload": {
 *     "company_name": "Mantra Group",
 *     "expiry_minutes": "15 min",
 *     "name": "<Employee Name>",
 *     "otp": "<6 digit OTP>"
 *   }
 * }
 */
export class EmailOtpDeliveryProvider implements OtpDeliveryProvider {
  name = "EmailDeliveryProvider";

  async sendOtp(params: SendOtpParams): Promise<OtpDeliveryResult> {
    const token = process.env.NOTIFY_EMAIL_TOKEN?.trim();
    const endpoint =
      process.env.NOTIFY_API_URL?.trim() ||
      "https://api-notify.mantracare.com/api/v1/notifications/trigger";

    if (!token) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[OTP Delivery] NOTIFY_EMAIL_TOKEN is not configured; falling back to Console Delivery.`
        );
        return new ConsoleOtpDeliveryProvider().sendOtp(params);
      }
      return {
        success: false,
        provider: this.name,
        error: "NOTIFY_EMAIL_TOKEN is not configured in environment variables. Email delivery unavailable.",
      };
    }

    try {
      const recipientEmail = params.email.trim();
      const payload = {
        trigger: "OTP Email",
        recipients: [recipientEmail],
        payload: {
          company_name: params.companyName || "Mantra Group",
          expiry_minutes: params.expiryMinutes || "15 min",
          name: params.userName || "Employee",
          otp: params.otp,
        },
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(
          `[OTP Delivery] MantraCare Notify API error HTTP ${response.status}: ${errorText}`
        );
        return {
          success: false,
          provider: this.name,
          error: `Notify API responded with HTTP ${response.status}: ${errorText || response.statusText}`,
        };
      }

      const resData = await response.json().catch(() => null);
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[OTP Delivery] Successfully dispatched OTP email to ${maskEmail(recipientEmail)} via MantraCare Notify API.`
        );
      }

      return {
        success: true,
        provider: this.name,
        messageId: resData?.id || resData?.messageId || `notify_${randomBytes(8).toString("hex")}`,
      };
    } catch (err: any) {
      console.error("[OTP Delivery] Network error dispatching OTP email:", err?.message);
      return {
        success: false,
        provider: this.name,
        error: err?.message || "Network error while connecting to MantraCare Notify API",
      };
    }
  }
}

let activeOtpProvider: OtpDeliveryProvider =
  process.env.NODE_ENV === "test"
    ? new ConsoleOtpDeliveryProvider()
    : new EmailOtpDeliveryProvider();

export function setOtpDeliveryProvider(provider: OtpDeliveryProvider) {
  activeOtpProvider = provider;
}

export function getOtpDeliveryProvider(): OtpDeliveryProvider {
  if (process.env.NODE_ENV === "test" && activeOtpProvider.name === "EmailDeliveryProvider") {
    return new ConsoleOtpDeliveryProvider();
  }
  return activeOtpProvider;
}

/**
 * Asserts that the OTP configuration is secure.
 * Rejects any startup attempt where ALLOW_STAGING_STATIC_OTP is enabled in production.
 */
export function assertValidOtpConfig(): void {
  const isProd = process.env.PAYROLL_DB_ENV === "production" || process.env.NODE_ENV === "production";
  const staticOtpEnabled = process.env.ALLOW_STAGING_STATIC_OTP === "true";

  if (isProd && staticOtpEnabled) {
    throw new Error(
      "CRITICAL SECURITY CONFIGURATION ERROR: ALLOW_STAGING_STATIC_OTP cannot be enabled in production environments!"
    );
  }
}

/**
 * Strictly verifies whether static OTP (123456) is permitted.
 * ONLY when ALLOW_STAGING_STATIC_OTP === "true" is static OTP 123456 allowed.
 * Otherwise, the email API sends the real OTP and only the emailed OTP is accepted.
 * CANNOT be enabled when PAYROLL_DB_ENV === 'production'.
 */
export function isStaticDevOtpAllowed(): boolean {
  if (process.env.PAYROLL_DB_ENV === "production") return false;

  return process.env.ALLOW_STAGING_STATIC_OTP === "true";
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

