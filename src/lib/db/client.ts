import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { resolveDatabaseConfig, getSafeDatabaseDiagnostics, DatabaseConfig } from "./config";

let cachedState: {
  dbConfig: DatabaseConfig;
  rawClient: Client;
  db: LibSQLDatabase<typeof schema>;
} | null = null;

function getDbState() {
  if (!cachedState) {
    const dbConfig = resolveDatabaseConfig();
    const rawClient = createClient({
      url: dbConfig.url,
      authToken: dbConfig.authToken,
    });
    const db = drizzle(rawClient, { schema });
    cachedState = { dbConfig, rawClient, db };
  }
  return cachedState;
}

function createLazyProxy<T extends object>(getter: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const instance = getter();
      const value = Reflect.get(instance, prop, instance);
      return typeof value === "function" ? value.bind(instance) : value;
    },
    has(_target, prop) {
      return prop in getter();
    },
    ownKeys() {
      return Reflect.ownKeys(getter());
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(getter(), prop);
    },
  });
}

// Defer DB config resolution until first runtime access so `next build` can
// collect route metadata in Docker without baking runtime DB secrets into the image.
export const dbConfig: DatabaseConfig = createLazyProxy(() => getDbState().dbConfig);
export const rawClient: Client = createLazyProxy(() => getDbState().rawClient);
export const db: LibSQLDatabase<typeof schema> = createLazyProxy(() => getDbState().db);

export { resolveDatabaseConfig, getSafeDatabaseDiagnostics };

