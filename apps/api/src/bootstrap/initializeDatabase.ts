/**
 * The application's database initializer.
 *
 * Binds the real platform boot services to the kernel `initDb` orchestrator, so
 * every production entry (API, worker, scripts) uses the same pipeline while
 * `db/dbInit.ts` itself imports no service. Tests that need the real function
 * (only `dbInitBootLock.test.ts`; the other 101 files mock `db/database.js`) pass
 * their own stub bag to `initDb` instead.
 *
 * Usage:
 *   await initializeDatabase();                       // full boot (API, worker, scripts)
 *   await initializeDatabase({ force: true });        // re-run in tests/dev
 *   await initializeDatabase({ services: stubs });    // explicit composition
 */
import { initDb } from "../db/dbInit.js";
import { createPlatformBootServices, type PlatformBootServices } from "./bootServices.js";
import { configureModuleAdapters } from "./configureModuleAdapters.js";

export function initializeDatabase(
  options: { force?: boolean; services?: PlatformBootServices } = {},
): Promise<void> {
  if (!options.services) {
    configureModuleAdapters();
  }
  return initDb({
    services: options.services ?? createPlatformBootServices(),
    force: options.force,
  });
}
