import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  EmailOtpDeliveryProvider,
  ConsoleOtpDeliveryProvider,
  getOtpDeliveryProvider,
  setOtpDeliveryProvider,
} from "../src/lib/auth/otp";

describe("MantraCare Notify API OTP Delivery Provider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should format and dispatch payload with Authorization header to MantraCare Notify API", async () => {
    const mockToken = "test_notify_token_12345";
    process.env.NOTIFY_EMAIL_TOKEN = mockToken;
    process.env.NOTIFY_API_URL = "https://api-notify.mantracare.com/api/v1/notifications/trigger";

    let interceptedUrl = "";
    let interceptedOptions: any = null;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      interceptedUrl = url;
      interceptedOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "msg_abc123", status: "queued" }),
        text: async () => JSON.stringify({ id: "msg_abc123" }),
      } as Response;
    });

    const provider = new EmailOtpDeliveryProvider();
    const result = await provider.sendOtp({
      email: "karan@mantracare.com",
      otp: "482910",
      challengeId: "test_challenge_1",
      userName: "Karan",
      expiryMinutes: "15 min",
      companyName: "Mantra Group",
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe("EmailDeliveryProvider");
    expect(result.messageId).toBe("msg_abc123");

    expect(interceptedUrl).toBe("https://api-notify.mantracare.com/api/v1/notifications/trigger");
    expect(interceptedOptions.method).toBe("POST");
    expect(interceptedOptions.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: `Bearer ${mockToken}`,
    });

    const body = JSON.parse(interceptedOptions.body);
    expect(body).toEqual({
      trigger: "OTP Email",
      recipients: ["karan@mantracare.com"],
      payload: {
        company_name: "Mantra Group",
        expiry_minutes: "15",
        name: "Karan",
        otp: "482910",
      },
    });
  });

  it("should handle Notify API HTTP failure gracefully", async () => {
    process.env.NOTIFY_EMAIL_TOKEN = "invalid_token";

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "Invalid notification bearer token",
    } as Response);

    const provider = new EmailOtpDeliveryProvider();
    const result = await provider.sendOtp({
      email: "employee@mantracare.com",
      otp: "123456",
      challengeId: "test_challenge_2",
      userName: "Employee",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("HTTP 401");
  });

  it("should fallback to ConsoleDeliveryProvider when NOTIFY_EMAIL_TOKEN is unset in non-production", async () => {
    delete process.env.NOTIFY_EMAIL_TOKEN;
    process.env.NODE_ENV = "development";

    const provider = new EmailOtpDeliveryProvider();
    const result = await provider.sendOtp({
      email: "dev@mantracare.com",
      otp: "999888",
      challengeId: "test_dev_challenge",
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe("ConsoleDeliveryProvider");
  });
});
