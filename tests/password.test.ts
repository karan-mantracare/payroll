import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, benchmarkBcrypt } from "../src/lib/security/password";

describe("Bcrypt Password Hashing & Performance Benchmarks", () => {
  it("should securely hash a password using bcrypt with cost factor 12", async () => {
    const plain = "SuperSecret_MantraCare_2026!";
    const hash = await hashPassword(plain, 12);

    expect(hash).toBeDefined();
    expect(hash.startsWith("$2b$12$") || hash.startsWith("$2a$12$")).toBe(true);

    // Verification succeeds with correct password
    const isMatch = await verifyPassword(plain, hash);
    expect(isMatch).toBe(true);

    // Verification fails with incorrect password
    const wrongMatch = await verifyPassword("WrongPassword123", hash);
    expect(wrongMatch).toBe(false);
  });

  it("should benchmark bcrypt performance on the local deployment environment", async () => {
    const bench12 = await benchmarkBcrypt(12);

    console.log(`[Benchmark] Bcrypt cost factor ${bench12.rounds}:`);
    console.log(`  -> Hash Generation Time: ${bench12.hashTimeMs} ms`);
    console.log(`  -> Hash Verification Time: ${bench12.verifyTimeMs} ms`);
    console.log(`  -> Total Operation Time: ${bench12.totalTimeMs} ms`);

    expect(bench12.rounds).toBe(12);
    expect(bench12.hashTimeMs).toBeGreaterThan(0);
    expect(bench12.verifyTimeMs).toBeGreaterThan(0);
  });
});
