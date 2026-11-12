import { describe, expect, it } from "vitest";
import { registerDocumentAndFinanceJobRunners } from "../services/backgroundJobDocumentFinanceRunners.js";
import { hasBackgroundJobRunner } from "../services/backgroundJobWorkerService.js";

/**
 * The finance job surface must equal the enqueue surface.
 *
 * The finance routes that used to enqueue `finance:collect`, `finance:render-*`
 * and `finance:export-excel` never did — automation now runs as a leader-only
 * sweep, the receipt/ledger/Excel runners had no enqueue path, and CSV
 * export/import fail fast with 503 because no runner is registered. Keeping the
 * dead registrations would advertise a queue pipeline that never runs.
 */
describe("finance/accounting background job surface", () => {
  it("registers only runners that have an enqueue path", () => {
    registerDocumentAndFinanceJobRunners();

    expect(hasBackgroundJobRunner("students:render-report-card")).toBe(true);
    for (const key of [
      "finance:collect",
      "finance:render-receipt",
      "finance:render-ledger",
      "finance:export-excel",
      "finance:export",
      "finance:import",
      "accounting:export",
      "accounting:import",
    ]) {
      expect(hasBackgroundJobRunner(key), key).toBe(false);
    }
  });
});
