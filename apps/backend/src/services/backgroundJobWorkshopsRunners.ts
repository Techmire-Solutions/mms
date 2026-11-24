import { WORKSHOPS_MODULE_MANIFEST } from "@mms/contracts";
import { registerModuleCsvExportJobRunner } from "../lib/registerModuleCsvExportJobRunner.js";
import { buildWorkshopsCsvExport } from "./workshopsExportService.js";

/** `workshops:export` — workshop-event CSV export via the shared transfer schema. */
export function registerWorkshopsExportJobRunner(): void {
  registerModuleCsvExportJobRunner({
    moduleId: WORKSHOPS_MODULE_MANIFEST.moduleId,
    entityNounPlural: "workshops",
    buildExport: (query, options, tenant, signal) =>
      buildWorkshopsCsvExport(
        query as Record<string, unknown>,
        {
          columns: options.columns,
          filename: options.filename,
          viewerRole: options.viewerRole,
          allowDeleted: options.allowDeleted,
        },
        tenant,
        signal,
      ),
  });
}
