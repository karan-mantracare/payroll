import { defineConfig } from "drizzle-kit";
import { resolveDatabaseConfig } from "./src/lib/db/config";

const config = resolveDatabaseConfig();

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "turso",
  dbCredentials: {
    url: config.url,
    authToken: config.authToken,
  },
});

