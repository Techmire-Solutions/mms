/**
 * Locate the Drizzle schema TypeScript sources (`packages/db/src/schema`).
 *
 * Schema-parity tests assert the DDL and the Drizzle model agree by reading the
 * source text, so they need the package's `.ts` directory rather than
 * `dist/` compiled output. Test-only helper (re-exported from `@mms/db/testing`).
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveSchemaSourceDirectory(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, "..", "src", "schema"), join(here, "schema")];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "finance.ts"))) return candidate;
  }
  throw new Error(
    `Could not locate the Drizzle schema sources. Looked in: ${candidates.join(", ")}.`,
  );
}
