import { describe, it, expect, beforeAll } from "vitest";
import { processProgramsHandshake } from "../src/lib/auth/handshake";
import { getSessionContext, revokeSession } from "../src/lib/auth/session";
import { isTokenUsed } from "../src/lib/auth/tokens";
import { seedDatabase } from "../src/lib/db/seed";
import { rawClient } from "../src/lib/db/client";

describe("Programs Platform Handshake & Authentication Engine", () => {
  beforeAll(async () => {
    process.env.MOCK_PROGRAMS_API = "true";
    await seedDatabase();
    await rawClient.execute("DELETE FROM used_tokens;");
    await rawClient.execute("DELETE FROM auth_sessions;");
  });

  it("should successfully authenticate an active mapped employee and mint session", async () => {
    const token = `test-token-employee-${Date.now()}`;
    const result = await processProgramsHandshake(token, "127.0.0.1", "TestAgent");

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.sessionId).toBeDefined();
    expect(result.user?.email).toBe("employee@mantracare.com");
    expect(result.user?.roles).toContain("EMPLOYEE");

    // Retrieve session context
    const context = await getSessionContext(result.sessionId);
    expect(context).not.toBeNull();
    expect(context?.name).toBe("Rohan Employee");
    expect(context?.widestScope).toBe("SELF");
  });

  it("should prevent token replay attacks (single-use token)", async () => {
    const replayToken = `test-token-employee-replay-${Date.now()}`;
    const firstAttempt = await processProgramsHandshake(replayToken, "127.0.0.1", "Legitimate");
    expect(firstAttempt.success).toBe(true);

    // Attempting to reuse the exact same token must be blocked
    const replayResult = await processProgramsHandshake(replayToken, "127.0.0.1", "Attacker");
    expect(replayResult.success).toBe(false);
    expect(replayResult.status).toBe(401);
    expect(replayResult.code).toBe("TOKEN_ALREADY_USED");
  });

  it("should reject platform users not enrolled in HRMS (403 Forbidden)", async () => {
    // test-token-unknown maps to a platform user not in the users table
    const unmappedResult = await processProgramsHandshake(
      `test-token-unknown_${Date.now()}`,
      "127.0.0.1",
      "Stranger"
    );

    expect(unmappedResult.success).toBe(false);
    expect(unmappedResult.status).toBe(403);
    expect(unmappedResult.code).toBe("NOT_AN_AUTHORIZED_EMPLOYEE");
  });

  it("should properly revoke an active session on logout", async () => {
    const adminToken = `test-token-admin-${Date.now()}`;
    const res = await processProgramsHandshake(adminToken, "127.0.0.1", "AdminDevice");
    expect(res.success).toBe(true);

    const sessionId = res.sessionId!;
    let validContext = await getSessionContext(sessionId);
    expect(validContext).not.toBeNull();

    // Explicit revocation
    await revokeSession(sessionId);

    // After revocation, session must resolve to null
    let revokedContext = await getSessionContext(sessionId);
    expect(revokedContext).toBeNull();
  });

  it("should reject expired platform tokens", async () => {
    const expiredResult = await processProgramsHandshake("test-token-expired-user", "127.0.0.1", "Browser");
    expect(expiredResult.success).toBe(false);
    expect(expiredResult.status).toBe(401);
    expect(expiredResult.code).toBe("TOKEN_EXPIRED");
  });

  it("should prevent simultaneous race condition token redemption", async () => {
    const concurrentToken = `test-token-employee-race-${Date.now()}`;

    // Two simultaneous redemption requests firing concurrently
    const [res1, res2] = await Promise.all([
      processProgramsHandshake(concurrentToken, "127.0.0.1", "ClientA"),
      processProgramsHandshake(concurrentToken, "127.0.0.1", "ClientB"),
    ]);

    // Exactly one must succeed and the other must be blocked with TOKEN_ALREADY_USED
    const successes = [res1, res2].filter((r) => r.success);
    const failures = [res1, res2].filter((r) => !r.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    expect(failures[0].code).toBe("TOKEN_ALREADY_USED");
    expect(failures[0].status).toBe(401);
  });
});
