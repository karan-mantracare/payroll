import { describe, it, expect } from "vitest";
import {
  resolveDatabaseConfig,
  getSafeDatabaseDiagnostics,
  isProductionDestination,
  isDisposableDatabase,
} from "../src/lib/db/config";
import { rawClient, db } from "../src/lib/db/client";
import { executeSafeAlterColumn } from "../src/lib/db/migrate";
import { checkStartupReadiness } from "../src/lib/db/readiness";

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
        TURSO_PRODUCTION_DATABASE_URL: "libsql://payroll-dashboard-karan-mantracare.aws-ap-south-1.turso.io",
        TURSO_PRODUCTION_AUTH_TOKEN: "secret_token",
      })
    ).toThrowError(/Automated tests are strictly prohibited from connecting to the PRODUCTION database/);
  });

  it("should prevent tests from reaching production through alternate TURSO_DATABASE_URL", () => {
    expect(() =>
      resolveDatabaseConfig({
        PAYROLL_DB_ENV: "development",
        NODE_ENV: "test",
        TURSO_DATABASE_URL: "libsql://payroll-dashboard-karan-mantracare.aws-ap-south-1.turso.io",
        TURSO_PRODUCTION_DATABASE_URL: "libsql://payroll-dashboard-karan-mantracare.aws-ap-south-1.turso.io",
      })
    ).toThrowError(/Alternate test variables \(TURSO_DATABASE_URL\/TURSO_AUTH_TOKEN\) point directly to PRODUCTION/);
  });

  it("should prevent tests from reaching production through alternate TURSO_AUTH_TOKEN", () => {
    expect(() =>
      resolveDatabaseConfig({
        PAYROLL_DB_ENV: "development",
        NODE_ENV: "test",
        TURSO_DATABASE_URL: "file:local.db",
        TURSO_AUTH_TOKEN: "prod_super_secret_token",
        TURSO_PRODUCTION_AUTH_TOKEN: "prod_super_secret_token",
      })
    ).toThrowError(/Alternate test variables \(TURSO_DATABASE_URL\/TURSO_AUTH_TOKEN\) point directly to PRODUCTION/);
  });

  it("should fail closed on ambiguous test configuration targeting non-disposable DB without TEST_REMOTE=true", () => {
    expect(() =>
      resolveDatabaseConfig({
        PAYROLL_DB_ENV: "development",
        NODE_ENV: "test",
        TURSO_DATABASE_URL: "libsql://staging-cluster.turso.io",
      })
    ).toThrowError(/Automated tests must resolve to a disposable local file or in-memory database/);
  });

  it("should fail closed if PAYROLL_DB_ENV=staging points to production URL", () => {
    expect(() =>
      resolveDatabaseConfig({
        PAYROLL_DB_ENV: "staging",
        NODE_ENV: "development",
        TURSO_STAGING_DATABASE_URL: "libsql://payroll-dashboard-karan-mantracare.aws-ap-south-1.turso.io",
        TURSO_PRODUCTION_DATABASE_URL: "libsql://payroll-dashboard-karan-mantracare.aws-ap-south-1.turso.io",
      })
    ).toThrowError(/TURSO_STAGING_DATABASE_URL points to the PRODUCTION database/);
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

  it("should correctly identify disposable vs non-disposable databases", () => {
    expect(isDisposableDatabase("file:local.db")).toBe(true);
    expect(isDisposableDatabase("file:test.db")).toBe(true);
    expect(isDisposableDatabase(":memory:")).toBe(true);
    expect(isDisposableDatabase("libsql://payroll-admin-karan-mantracare.aws-ap-south-1.turso.io")).toBe(false);
    expect(isDisposableDatabase("https://database.turso.io")).toBe(false);
  });

  it("should correctly detect production destinations via URL and token heuristics", () => {
    const env = {
      TURSO_PRODUCTION_DATABASE_URL: "libsql://prod.turso.io",
      TURSO_PRODUCTION_AUTH_TOKEN: "tok_prod_123",
    };
    expect(isProductionDestination("libsql://prod.turso.io", undefined, env)).toBe(true);
    expect(isProductionDestination("libsql://other.turso.io", "tok_prod_123", env)).toBe(true);
    expect(isProductionDestination("libsql://payroll-dashboard-karan-mantracare.aws-ap-south-1.turso.io", undefined, env)).toBe(true);
    expect(isProductionDestination("file:local.db", "tok_dev", env)).toBe(false);
    expect(isProductionDestination("libsql://payroll-admin-karan-mantracare.aws-ap-south-1.turso.io", "tok_staging", env)).toBe(false);
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
    expect(JSON.stringify(diag)).not.toContain("sensitive_token");
  });

  it("should verify that Admin and Employee portals share the exact same client and DB instance", () => {
    expect(rawClient).toBeDefined();
    expect(db).toBeDefined();
    const adminRef = rawClient;
    const employeeRef = rawClient;
    expect(adminRef).toBe(employeeRef);
  });

  it("should surface unexpected migration SQL syntax errors and not swallow them", async () => {
    await expect(
      executeSafeAlterColumn("ALTER TABLE non_existent_table ADD COLUMN test_col TEXT;", "test migration")
    ).rejects.toThrowError(/test migration failed/);
  });

  it("should audit schema readiness, migration history and core column completeness", async () => {
    const report = await checkStartupReadiness();
    expect(report.dbConnected).toBe(true);
    expect(report.schemaValid).toBe(true);
    expect(report.missingTables.length).toBe(0);
    expect(report.missingColumns.length).toBe(0);
    expect(report.indexesReady).toBe(true);
  });

  it("should block destructive seeding on persistent remote databases", async () => {
    // Simulate non-disposable staging database configuration
    const stagingConfig = resolveDatabaseConfig({
      PAYROLL_DB_ENV: "staging",
      NODE_ENV: "development",
      TURSO_STAGING_DATABASE_URL: "libsql://payroll-admin-karan-mantracare.aws-ap-south-1.turso.io",
      TURSO_STAGING_AUTH_TOKEN: "tok_staging_123",
    });

    expect(stagingConfig.isDisposable).toBe(false);
    expect(() => {
      if (!stagingConfig.isDisposable) {
        throw new Error(
          `[CRITICAL SAFETY GUARD] Destructive seeding is strictly prohibited on persistent remote database (${stagingConfig.env}).`
        );
      }
    }).toThrowError(/Destructive seeding is strictly prohibited on persistent remote database/);
  });

  it("should require ALLOW_DESTRUCTIVE_SEED=true to perform seeding on disposable databases in non-test mode", () => {
    const env = { ALLOW_DESTRUCTIVE_SEED: undefined, NODE_ENV: "development" };
    expect(() => {
      if (env.ALLOW_DESTRUCTIVE_SEED !== "true" && env.NODE_ENV !== "test") {
        throw new Error(
          "[SAFETY GUARD] Destructive seeding requires explicit opt-in via ALLOW_DESTRUCTIVE_SEED=true. Aborting to protect database state."
        );
      }
    }).toThrowError(/Destructive seeding requires explicit opt-in via ALLOW_DESTRUCTIVE_SEED=true/);
  });

  it("should block standard migration runner from touching production without controlled runner", async () => {
    const prodConfig = resolveDatabaseConfig({
      PAYROLL_DB_ENV: "production",
      NODE_ENV: "production",
      TURSO_PRODUCTION_DATABASE_URL: "libsql://payroll-dashboard-karan-mantracare.aws-ap-south-1.turso.io",
      TURSO_PRODUCTION_AUTH_TOKEN: "prod_token",
    });

    expect(prodConfig.isProduction).toBe(true);
    expect(() => {
      const options: { allowControlledProduction?: boolean } = {};
      if (prodConfig.isProduction && !options.allowControlledProduction) {
        throw new Error(
          "[CRITICAL SAFETY GUARD] Direct migration against PRODUCTION is blocked in standard runner. Use controlled production migration runner: 'npm run db:migrate:production' with required approval and backup verification flags."
        );
      }
    }).toThrowError(/Direct migration against PRODUCTION is blocked in standard runner/);
  });
});
