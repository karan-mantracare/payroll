import { NextResponse } from "next/server";
import { validateEncryptionConfig } from "@/lib/security/crypto";

export async function GET() {
  const encConfig = validateEncryptionConfig();

  return NextResponse.json(
    {
      status: encConfig.isValid ? "healthy" : "degraded",
      timestamp: Date.now(),
      service: "mantracare-payroll",
      platform: "minis",
      version: "1.0.0",
      security: {
        encryptionReady: encConfig.isValid,
        activeKeyVersion: encConfig.activeVersion,
        configuredVersions: encConfig.configuredVersions,
        ...(encConfig.isValid ? {} : { errors: encConfig.errors }),
      },
    },
    { status: encConfig.isValid ? 200 : 503 }
  );
}


