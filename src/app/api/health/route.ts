import { NextResponse } from "next/server";
import { validateEncryptionConfig } from "@/lib/security/crypto";
import { checkStartupReadiness } from "@/lib/db/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const encConfig = validateEncryptionConfig();
  const dbReadiness = await checkStartupReadiness().catch(() => ({
    ready: false,
    dbConnected: false,
    missingTables: ["unknown"],
    indexesReady: false,
  }));

  const isHealthy = encConfig.isValid && dbReadiness.ready;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: Date.now(),
      service: "mantracare-payroll",
      platform: "minis",
      version: "1.0.0",
      database: {
        connected: dbReadiness.dbConnected,
        tablesReady: dbReadiness.missingTables.length === 0,
        missingTables: dbReadiness.missingTables,
        indexesReady: dbReadiness.indexesReady,
      },
      security: {
        encryptionReady: encConfig.isValid,
        activeKeyVersion: encConfig.activeVersion,
        configuredVersions: encConfig.configuredVersions,
        ...(encConfig.isValid ? {} : { errors: encConfig.errors }),
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
