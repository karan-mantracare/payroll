export type PayrollDbEnv = "development" | "staging" | "production" | "test";

export interface DatabaseConfig {
  env: PayrollDbEnv;
  url: string;
  authToken?: string;
  isProduction: boolean;
  isStaging: boolean;
  isDevelopment: boolean;
  isTest: boolean;
}

/**
 * Resolves the active database configuration based on PAYROLL_DB_ENV and explicit environment rules.
 *
 * Rules:
 * 1. PAYROLL_DB_ENV must be one of: 'development', 'staging', 'production' (or 'test').
 * 2. In production, TURSO_PRODUCTION_DATABASE_URL is mandatory.
 * 3. In staging, TURSO_STAGING_DATABASE_URL is mandatory.
 * 4. No automatic fallback between environments is allowed.
 * 5. Automated tests are strictly prohibited from connecting to production.
 * 6. Auth tokens are never exposed or logged.
 */
export function resolveDatabaseConfig(customEnv?: Record<string, string | undefined>): DatabaseConfig {
  const envSource = customEnv || process.env;

  // If running in standalone Node/CLI scripts and no custom env passed, load env files
  if (!customEnv && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(".env.local");
    } catch {
      try {
        process.loadEnvFile(".env");
      } catch {}
    }
  }

  const rawEnv = (envSource.PAYROLL_DB_ENV || "").trim().toLowerCase();
  const isTest = envSource.NODE_ENV === "test";

  // Automated test environment safety guard
  if (isTest) {
    if (rawEnv === "production") {
      throw new Error(
        "[Database Safety Violation] Automated tests are strictly prohibited from connecting to the PRODUCTION database (PAYROLL_DB_ENV=production)."
      );
    }
    // Remote staging tests are only permitted if explicitly requested via TEST_REMOTE=true
    if (envSource.TEST_REMOTE === "true" && envSource.TURSO_STAGING_DATABASE_URL) {
      return {
        env: "staging",
        url: envSource.TURSO_STAGING_DATABASE_URL.trim(),
        authToken: envSource.TURSO_STAGING_AUTH_TOKEN?.trim() || undefined,
        isProduction: false,
        isStaging: true,
        isDevelopment: false,
        isTest: true,
      };
    }
    // Default test DB: isolated SQLite
    return {
      env: "test",
      url: envSource.TURSO_DATABASE_URL?.trim() || "file:local.db",
      authToken: envSource.TURSO_AUTH_TOKEN?.trim() || undefined,
      isProduction: false,
      isStaging: false,
      isDevelopment: true,
      isTest: true,
    };
  }

  if (rawEnv === "production") {
    const url = envSource.TURSO_PRODUCTION_DATABASE_URL?.trim();
    const authToken = envSource.TURSO_PRODUCTION_AUTH_TOKEN?.trim() || undefined;

    if (!url) {
      throw new Error(
        "[Database Configuration Error] Missing TURSO_PRODUCTION_DATABASE_URL for PAYROLL_DB_ENV=production. Automatic fallback between environments is strictly forbidden."
      );
    }
    if (url.startsWith("file:")) {
      throw new Error(
        "[Database Configuration Error] SQLite local file URL is forbidden in production mode. A remote Turso URL is required."
      );
    }

    return {
      env: "production",
      url,
      authToken,
      isProduction: true,
      isStaging: false,
      isDevelopment: false,
      isTest: false,
    };
  }

  if (rawEnv === "staging") {
    const url = envSource.TURSO_STAGING_DATABASE_URL?.trim();
    const authToken = envSource.TURSO_STAGING_AUTH_TOKEN?.trim() || undefined;

    if (!url) {
      throw new Error(
        "[Database Configuration Error] Missing TURSO_STAGING_DATABASE_URL for PAYROLL_DB_ENV=staging. Automatic fallback between environments is strictly forbidden."
      );
    }

    return {
      env: "staging",
      url,
      authToken,
      isProduction: false,
      isStaging: true,
      isDevelopment: false,
      isTest: false,
    };
  }

  if (rawEnv === "development" || rawEnv === "local") {
    const url = envSource.TURSO_DATABASE_URL?.trim() || "file:local.db";
    const authToken = envSource.TURSO_AUTH_TOKEN?.trim() || undefined;

    return {
      env: "development",
      url,
      authToken,
      isProduction: false,
      isStaging: false,
      isDevelopment: true,
      isTest: false,
    };
  }

  if (rawEnv !== "") {
    throw new Error(
      `[Database Configuration Error] Invalid PAYROLL_DB_ENV: "${rawEnv}". Allowed values: 'development', 'staging', 'production'.`
    );
  }

  // If PAYROLL_DB_ENV is unset
  if (envSource.NODE_ENV === "production") {
    throw new Error(
      "[Database Configuration Error] PAYROLL_DB_ENV is missing. In production mode, PAYROLL_DB_ENV must be explicitly set to 'production'."
    );
  }

  // Default to development
  return {
    env: "development",
    url: envSource.TURSO_DATABASE_URL?.trim() || "file:local.db",
    authToken: envSource.TURSO_AUTH_TOKEN?.trim() || undefined,
    isProduction: false,
    isStaging: false,
    isDevelopment: true,
    isTest: false,
  };
}

/**
 * Returns safe diagnostic information about the database connection without exposing credentials.
 */
export function getSafeDatabaseDiagnostics(config?: DatabaseConfig) {
  const cfg = config || resolveDatabaseConfig();
  const urlObj = (() => {
    try {
      if (cfg.url.startsWith("file:")) return { protocol: "file:", host: cfg.url };
      const parsed = new URL(cfg.url);
      return { protocol: parsed.protocol, host: parsed.host };
    } catch {
      return { protocol: "unknown", host: "masked" };
    }
  })();

  return {
    environment: cfg.env,
    protocol: urlObj.protocol,
    host: urlObj.host,
    hasAuthToken: Boolean(cfg.authToken),
    isProduction: cfg.isProduction,
    isStaging: cfg.isStaging,
    isDevelopment: cfg.isDevelopment,
    isTest: cfg.isTest,
  };
}

