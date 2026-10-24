import { defineConfig } from "drizzle-kit";

// Fail closed: a missing DATABASE_URL must not silently point drizzle-kit at a
// localhost database (a foot-gun if the command is ever run against prod config).
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run drizzle-kit.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations_drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
