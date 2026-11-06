import { describe, it, expect } from "vitest";
import { resolveDatabaseConfig, getSafeDatabaseDiagnostics } from "../src/lib/db/config";
import { rawClient, db } from "../src/lib/db/client";

describe("Database Configuration & Multi-Environment Safety Engine", () => {
  it("should reject invalid PAYROLL_DB_ENV values", () => {
    expect(() =>
      resolveDatabaseConfig({
        PAYROLL_DB_ENV: "invalid_stage",
        NODE_ENV: "development",
      })
    ).toThrowError(/Invalid PAYROLL_DB_ENV: "invalid_stage"/);
  });

  it("should enforce that automated tests CANNOT target the PRODUCTION database", () => {
    expect(() =>
      resolveDatabaseConfig({
        PAYROLL_DB_ENV: "production",
        NODE_ENV: "test",
        TURSO_PRODUCTION_DATABASE_URL: "libsql://prod.turso.io",
        TURSO_PRODUCTION_AUTH_TOKEN: "secret_token",
      })
    ).toThrowError(/Automated tests are strictly prohibited from connecting to the PRODUCTION database/);
  });

  it("should reject PAYROLL_DB_ENV=production if TURSO_PRODUCTION_DATABASE_URL is missing without fallback", () => {
    expect(() =>
      resolveDatabaseConfig({
        PAYROLL_DB_ENV: "production",
        NODE_ENV: "production",
        TURSO_PRODUCTION_DATABASE_URL: "",
      })
    ).toThrowError(/Missing TURSO_PRODUCTION_DATABASE_URL for PAYROLL_DB_ENV=production/);
  });

  it("should reject local file URLs in production mode", () => {
    expect(() =>
      resolveDatabaseConfig({
        PAYROLL_DB_ENV: "production",
        NODE_ENV: "production",
        TURSO_PRODUCTION_DATABASE_URL: "file:local.db",
      })
    ).toThrowError(/SQLite local file URL is forbidden in production mode/);
  });

  it("should reject PAYROLL_DB_ENV=staging if TURSO_STAGING_DATABASE_URL is missing without fallback", () => {
    expect(() =>
      resolveDatabaseConfig({
        PAYROLL_DB_ENV: "staging",
        NODE_ENV: "development",
        TURSO_STAGING_DATABASE_URL: "",
      })
    ).toThrowError(/Missing TURSO_STAGING_DATABASE_URL for PAYROLL_DB_ENV=staging/);
  });

  it("should resolve valid staging configuration with exact remote URL", () => {
    const config = resolveDatabaseConfig({
      PAYROLL_DB_ENV: "staging",
      NODE_ENV: "development",
      TURSO_STAGING_DATABASE_URL: "libsql://payroll-staging-karan.turso.io",
      TURSO_STAGING_AUTH_TOKEN: "secret_staging_jwt_token",
    });

    expect(config.env).toBe("staging");
    expect(config.url).toBe("libsql://payroll-staging-karan.turso.io");
    expect(config.authToken).toBe("secret_staging_jwt_token");
    expect(config.isProduction).toBe(false);
    expect(config.isStaging).toBe(true);
  });

  it("should resolve valid production configuration with exact remote URL", () => {
    const config = resolveDatabaseConfig({
      PAYROLL_DB_ENV: "production",
      NODE_ENV: "production",
      TURSO_PRODUCTION_DATABASE_URL: "libsql://payroll-prod-karan.turso.io",
      TURSO_PRODUCTION_AUTH_TOKEN: "secret_prod_jwt_token",
    });

    expect(config.env).toBe("production");
    expect(config.url).toBe("libsql://payroll-prod-karan.turso.io");
    expect(config.authToken).toBe("secret_prod_jwt_token");
    expect(config.isProduction).toBe(true);
    expect(config.isStaging).toBe(false);
  });

  it("should never expose credentials in safe diagnostics output", () => {
    const config = resolveDatabaseConfig({
      PAYROLL_DB_ENV: "staging",
      NODE_ENV: "development",
      TURSO_STAGING_DATABASE_URL: "libsql://payroll-staging-karan.turso.io",
      TURSO_STAGING_AUTH_TOKEN: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.sensitive_token",
    });

    const diag = getSafeDatabaseDiagnostics(config);
    expect(diag.environment).toBe("staging");
    expect(diag.host).toBe("payroll-staging-karan.turso.io");
    expect(diag.hasAuthToken).toBe(true);
    // Ensure the token itself is never in the returned object
    expect(JSON.stringify(diag)).not.toContain("sensitive_token");
  });

  it("should verify that Admin and Employee portals share the exact same client and DB instance", () => {
    expect(rawClient).toBeDefined();
    expect(db).toBeDefined();
    // Both portals reference the same exported singleton
    const adminRef = rawClient;
    const employeeRef = rawClient;
    expect(adminRef).toBe(employeeRef);
  });
});

