export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEncryptionReady } = await import("./lib/security/crypto");
    // In production or when strictly configured, fail fast on server startup if keys are invalid
    if (process.env.NODE_ENV === "production") {
      try {
        assertEncryptionReady();
        console.log("[Security] AES-256-GCM encryption keys validated successfully.");
      } catch (err: any) {
        console.error(`[CRITICAL] Server startup halted due to encryption configuration failure:`, err.message);
        throw err;
      }
    }
  }
}
