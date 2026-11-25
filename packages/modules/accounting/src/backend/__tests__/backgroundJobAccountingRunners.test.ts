import { describe, expect, it } from "vitest";
import type {
  AccountingCsvExportJobRunnerOptions,
  AccountingCsvImportJobRunnerOptions,
  AccountingRunnerDeps,
} from "../jobs/runnerDeps.js";
import { configureAccountingRunnerDeps } from "../jobs/runnerDeps.js";
import { registerAccountingBackgroundJobRunners } from "../jobs/backgroundJobAccountingRunners.js";

function captureDeps(): {
  deps: AccountingRunnerDeps;
  csvImports: AccountingCsvImportJobRunnerOptions[];
  csvExports: AccountingCsvExportJobRunnerOptions[];
} {
  const csvImports: AccountingCsvImportJobRunnerOptions[] = [];
  const csvExports: AccountingCsvExportJobRunnerOptions[] = [];
  const deps: AccountingRunnerDeps = {
    registerCsvImportJobRunner: (options) => csvImports.push(options),
    registerCsvExportJobRunner: (options) => csvExports.push(options),
    registerBackgroundJobRunner: () => undefined,
    buildReportDocument: async () => ({
      template: "trial-balance",
      data: {},
      filename: "statement.pdf",
      lang: "en",
      direction: "ltr",
    }),
    processPdfRenderJob: async () => ({ key: "artifact.pdf", storageType: "local" }),
    saveArtifact: async () => undefined,
  };
  return { deps, csvImports, csvExports };
}

describe("accounting background job runners", () => {
  it("registers the chart export as the async generator the stream runner drives", () => {
    const { deps, csvImports, csvExports } = captureDeps();
    configureAccountingRunnerDeps(deps);
    registerAccountingBackgroundJobRunners();

    expect(csvImports).toHaveLength(1);
    const chart = csvExports.find((options) => options.kind === undefined);
    expect(chart?.entityNounPlural).toBe("accounts");
    expect(chart?.generateStreamChunks).toBeTypeOf("function");

    const generator = chart!.generateStreamChunks!({}, { viewerRole: "accountant" });
    // The backend stream runner calls `.next()`. `streamExport` returns a
    // Readable — async-iterable but without `.next` — which would throw there.
    expect(generator.next).toBeTypeOf("function");
    expect(generator[Symbol.asyncIterator]).toBeTypeOf("function");
  });

  it("keeps the ledger export stream-only", async () => {
    const { deps, csvExports } = captureDeps();
    configureAccountingRunnerDeps(deps);
    registerAccountingBackgroundJobRunners();

    const ledger = csvExports.find((options) => options.kind === "export-ledger");
    await expect(ledger!.buildExport({}, { viewerRole: "accountant" })).rejects.toThrow(
      "stream-only",
    );
  });
});
