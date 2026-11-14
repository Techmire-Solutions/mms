/**
 * @file backgroundJobObligationsRunners.ts
 * @description Background-job runners for the Obligations module.
 *
 * Registered by the shared default registry (`registerDefaultBackgroundJobRunners`), not by the
 * route plugin: the API and the worker are separate processes, and a runner registered only in the
 * API makes the enqueue succeed and then dead-letter in the worker. This is the bug the hasanat
 * registry comment records; the obligations export route had no runner at all, so it answered 503.
 */

import { registerModuleCsvExportJobRunner } from "../lib/registerModuleCsvExportJobRunner.js";
import { OBLIGATIONS_MODULE_MANIFEST } from "@mms/shared";
import {
  buildObligationsCsvExport,
  type ObligationsExportOptions,
} from "./obligationsExportService.js";

export function registerObligationsJobRunners(): void {
  registerModuleCsvExportJobRunner({
    moduleId: OBLIGATIONS_MODULE_MANIFEST.moduleId,
    entityNounPlural: "obligation receipts",
    buildExport: (query, options, tenant, signal) =>
      buildObligationsCsvExport(
        query as Record<string, unknown>,
        options as ObligationsExportOptions,
        tenant,
        signal,
      ),
  });
}
