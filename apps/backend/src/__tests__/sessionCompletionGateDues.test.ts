import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The completion gate computes dues in one SQL lateral, which no unit test can execute without a
 * database. This pins the rule that matters: every component of the canonical open balance is
 * present, including the late fee.
 *
 * It existed without `late_fee_amt` while `getOutstandingAmountForInvoice` (the figure the rest of
 * Finance shows) includes it, so an enrollment owing only a late fee reported zero dues and passed
 * the certificate gate (audit W5). A text assertion is the right level here — the alternative is a
 * silent bypass that only a live database would reveal.
 */
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const gateSource = readFileSync(
  resolve(backendRoot, "src/db/repositories/sessionCompletionGateRepository.ts"),
  "utf8",
);

/** The `dues` lateral: its `LEFT JOIN LATERAL (` up to its `) dues ON true` terminator. */
function duesLateral(): string {
  const close = gateSource.indexOf(") dues ON true");
  expect(close, "the dues lateral must still close with `) dues ON true`").toBeGreaterThan(-1);
  const open = gateSource.lastIndexOf("LEFT JOIN LATERAL", close);
  expect(open, "the dues lateral must still open with a LEFT JOIN LATERAL").toBeGreaterThan(-1);
  return gateSource.slice(open, close);
}

describe("session completion dues gate (SQL)", () => {
  it("subtracts paid and credited amounts", () => {
    const lateral = duesLateral();
    expect(lateral).toContain("fi.paid_amt");
    expect(lateral).toContain("fi.credited_amt");
  });

  it("adds the late fee, the component that was missing", () => {
    // Without this an enrollment owing only a late fee passes the gate with zero dues.
    expect(duesLateral()).toContain("fi.late_fee_amt");
  });

  it("clamps each invoice at zero rather than netting a credit against another invoice", () => {
    expect(duesLateral()).toContain("GREATEST(0,");
  });

  it("ignores archived and cancelled invoices", () => {
    const lateral = duesLateral();
    expect(lateral).toContain("fi.deleted_at IS NULL");
    expect(lateral).toContain("fi.status <> 'cancelled'");
  });

  it("scopes to the enrollment's own invoices", () => {
    expect(duesLateral()).toContain("fi.enrollment_id = e.id");
  });
});
