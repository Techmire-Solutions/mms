/**
 * Hasanat background-job runners — registered by the shared default registry.
 *
 * The API and the worker are separate processes. Registering these from the `/api/hasanat` route
 * plugin (the previous location) made the jobs look runnable in the API only: the API accepted the
 * enqueue, then the worker found no runner, retried three times and dead-lettered the job without
 * issuing or importing a single card. `registerDefaultBackgroundJobRunners()` runs in both
 * processes, so the runners are now visible where the work actually happens.
 */

import { registerHasanatBulkAwardRunner } from "../hasanat/use-cases/hasanatBatchAwardJob.js";
import { registerHasanatImportRunner } from "../hasanat/use-cases/hasanatImportJob.js";

/** Idempotent: each underlying `register…` guards on its own module-level flag. */
export function registerHasanatJobRunners(): void {
  registerHasanatBulkAwardRunner();
  registerHasanatImportRunner();
}
