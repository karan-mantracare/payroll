import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { resolveDatabaseConfig, getSafeDatabaseDiagnostics, DatabaseConfig } from "./config";

export const dbConfig: DatabaseConfig = resolveDatabaseConfig();

export const rawClient = createClient({
  url: dbConfig.url,
  authToken: dbConfig.authToken,
});

export const db = drizzle(rawClient, { schema });

export { resolveDatabaseConfig, getSafeDatabaseDiagnostics };

