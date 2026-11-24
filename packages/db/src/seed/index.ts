/**
 * Seed fixture entry (`@mms/db/seed`).
 *
 * The JSON fixtures are optional local/demo data and are gitignored; the minimal
 * in-code seed is always available so a fresh database can boot without them.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export * from "./minimalSeeds.js";

/** Directory holding `seeds.json` / `seeds.json.gz` (`packages/db/seeds`). */
export function resolveSeedFixturesDirectory(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, "..", "..", "seeds"), join(here, "..", "..", "..", "seeds")];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!;
}

/** True when the optional `seeds.json` fixture file is present. */
export function seedFixturesAvailable(): boolean {
  return existsSync(join(resolveSeedFixturesDirectory(), "seeds.json"));
}
