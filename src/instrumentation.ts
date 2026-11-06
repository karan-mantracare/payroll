export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 1. In production, fail fast if AES-256-GCM encryption keys are invalid
    if (process.env.NODE_ENV === "production") {
      try {
        const { assertEncryptionReady } = await import("./lib/security/config-validator");
        assertEncryptionReady();
        console.log("[Security] AES-256-GCM encryption keys validated successfully.");
      } catch (err: any) {
        console.error("[CRITICAL] Server startup halted due to encryption configuration failure:", err.message);
        throw err;
      }
    }

    // 2. Startup schema & database readiness validation (read-only verification)
    try {
      const { checkStartupReadiness } = await import("./lib/db/readiness");
      const report = await checkStartupReadiness();
      if (!report.ready) {
        console.warn(
          `[Database] Notice: Schema not fully migrated. Missing ${report.missingTables.length} tables (${report.missingTables.join(", ")}). Run 'npm run db:migrate' to apply migrations.`
        );
      } else {
        console.log("[Database] All tables and indexes verified ready.");
      }
    } catch (err: any) {
      console.warn("[Database] Startup schema readiness warning:", err?.message);
    }
  }
}
