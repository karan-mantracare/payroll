export type PayrollDbEnv = "development" | "staging" | "production" | "test";

export interface DatabaseConfig {
  env: PayrollDbEnv;
  url: string;
  authToken?: string;
  isProduction: boolean;
  isStaging: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  isDisposable: boolean;
}

/**
 * Checks whether a database URL or token targets the production database.
 * Evaluates both explicit URL/token matches and hostname indicators.
 */
export function isProductionDestination(
  url?: string,
  token?: string,
  envSource: Record<string, string | undefined> = process.env
): boolean {
  const targetUrl = (url || "").trim().toLowerCase();
  const targetToken = (token || "").trim();

  const prodUrl = (envSource.TURSO_PRODUCTION_DATABASE_URL || "").trim().toLowerCase();
  const prodToken = (envSource.TURSO_PRODUCTION_AUTH_TOKEN || "").trim();

  if (targetUrl && prodUrl && targetUrl === prodUrl) return true;
  if (targetToken && prodToken && targetToken === prodToken) return true;

  // Known production cluster hostnames or URL patterns
  if (targetUrl.includes("payroll-dashboard")) return true;
  if (targetUrl.includes(".turso.io") && (targetUrl.includes("prod") || targetUrl.includes("-prd-"))) return true;

  return false;
}

/**
 * Checks whether a database URL represents an explicitly disposable local/test store.
 * Remote Turso databases (staging or production) are NEVER disposable.
 */
export function isDisposableDatabase(url: string): boolean {
  const trimmed = (url || "").trim().toLowerCase();
  return (
    trimmed.startsWith("file:") ||
    trimmed === ":memory:" ||
    trimmed.includes("localhost") ||
    trimmed.includes("127.0.0.1") ||
    (trimmed.endsWith(".db") && !trimmed.includes("://"))
  );
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
 * 7. Validate resolved destination URL/token, not only PAYROLL_DB_ENV. Fail closed on ambiguous configuration.
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
      const url = envSource.TURSO_STAGING_DATABASE_URL.trim();
      const authToken = envSource.TURSO_STAGING_AUTH_TOKEN?.trim() || undefined;

      if (isProductionDestination(url, authToken, envSource)) {
        throw new Error(
          "[Database Safety Violation] Critical: Remote test configuration points directly to the PRODUCTION database. Execution halted immediately."
        );
      }

      return {
        env: "staging",
        url,
        authToken,
        isProduction: false,
        isStaging: true,
        isDevelopment: false,
        isTest: true,
        isDisposable: isDisposableDatabase(url),
      };
    }

    // Default test DB: isolated SQLite
    const resolvedTestUrl = envSource.TURSO_DATABASE_URL?.trim() || "file:local.db";
    const resolvedTestToken = envSource.TURSO_AUTH_TOKEN?.trim() || undefined;

    // Validate that alternate variables (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN) do not point to production
    if (isProductionDestination(resolvedTestUrl, resolvedTestToken, envSource)) {
      throw new Error(
        "[Database Safety Violation] Critical: Alternate test variables (TURSO_DATABASE_URL/TURSO_AUTH_TOKEN) point directly to PRODUCTION. Execution halted immediately."
      );
    }

    // Fail closed if test attempts to target an ambiguous non-disposable database without TEST_REMOTE=true
    if (!isDisposableDatabase(resolvedTestUrl) && envSource.TEST_REMOTE !== "true") {
      throw new Error(
        `[Database Safety Violation] Ambiguous configuration: Automated tests must resolve to a disposable local file or in-memory database (resolved: ${resolvedTestUrl}). To run remote tests, set TEST_REMOTE=true explicitly.`
      );
    }

    return {
      env: "test",
      url: resolvedTestUrl,
      authToken: resolvedTestToken,
      isProduction: false,
      isStaging: false,
      isDevelopment: true,
      isTest: true,
      isDisposable: isDisposableDatabase(resolvedTestUrl),
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
    if (isDisposableDatabase(url)) {
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
      isDisposable: false,
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

    // Validate that staging does not point to production
    if (isProductionDestination(url, authToken, envSource)) {
      throw new Error(
        "[Database Configuration Error] Ambiguous configuration: PAYROLL_DB_ENV is set to staging, but TURSO_STAGING_DATABASE_URL points to the PRODUCTION database. Execution halted immediately."
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
      isDisposable: isDisposableDatabase(url),
    };
  }

  if (rawEnv === "development" || rawEnv === "local") {
    const url = envSource.TURSO_DATABASE_URL?.trim() || "file:local.db";
    const authToken = envSource.TURSO_AUTH_TOKEN?.trim() || undefined;

    // Validate that development does not target production
    if (isProductionDestination(url, authToken, envSource)) {
      throw new Error(
        "[Database Configuration Error] Ambiguous configuration: PAYROLL_DB_ENV is set to development, but TURSO_DATABASE_URL points to the PRODUCTION database. Execution halted immediately."
      );
    }

    return {
      env: "development",
      url,
      authToken,
      isProduction: false,
      isStaging: false,
      isDevelopment: true,
      isTest: false,
      isDisposable: isDisposableDatabase(url),
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
  const url = envSource.TURSO_DATABASE_URL?.trim() || "file:local.db";
  const authToken = envSource.TURSO_AUTH_TOKEN?.trim() || undefined;

  if (isProductionDestination(url, authToken, envSource)) {
    throw new Error(
      "[Database Configuration Error] Ambiguous configuration: Default database configuration points to the PRODUCTION database. Execution halted immediately."
    );
  }

  return {
    env: "development",
    url,
    authToken,
    isProduction: false,
    isStaging: false,
    isDevelopment: true,
    isTest: false,
    isDisposable: isDisposableDatabase(url),
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
    isDisposable: cfg.isDisposable,
  };
}
