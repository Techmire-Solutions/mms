/**
 * Composition adapter for the hasanat module.
 *
 * Binds the module's kernel ports to the app-only services it may not import
 * (background-job enqueue, CSV export job runner). Called once at app module load,
 * before background job runners register.
 */
import { configureHasanatPorts } from "@mms/mod-hasanat/backend/deps";
import { enqueueBackgroundJob } from "../../services/backgroundJobWorkerService.js";
import { registerModuleCsvExportJobRunner } from "../../lib/registerModuleCsvExportJobRunner.js";

export function configureHasanatAdapters(): void {
  configureHasanatPorts({
    enqueueBackgroundJob,
    registerModuleCsvExportJobRunner: (options) =>
      registerModuleCsvExportJobRunner(
        options as Parameters<typeof registerModuleCsvExportJobRunner>[0],
      ),
  });
}
