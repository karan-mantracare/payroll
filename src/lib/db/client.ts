import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Auto-load .env file if running via standalone Node/CLI scripts (Node 20.6+)
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore error if .env doesn't exist
  }
}

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

export const rawClient = createClient({
  url,
  authToken,
});

export const db = drizzle(rawClient, { schema });

