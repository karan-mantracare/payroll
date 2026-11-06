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

    // 2. Startup schema & database readiness validation
    try {
      const { ensureSchemaReady } = await import("./lib/db/readiness");
      await ensureSchemaReady();
      console.log("[Database] Schema readiness check completed successfully.");
    } catch (err: any) {
      console.warn("[Database] Startup schema readiness warning:", err?.message);
    }
  }
}
