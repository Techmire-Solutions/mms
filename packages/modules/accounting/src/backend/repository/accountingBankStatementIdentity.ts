import { createHash } from "node:crypto";

/**
 * Canonical economic content of a bank statement, ignoring identity and
 * timestamp fields, so a deterministic import id can recognise a duplicate
 * import without trusting the client-supplied id.
 */
export function bankStatementContentHash(input: {
  accountId: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  lines: Array<{ date: string; description?: string; amount: number }>;
}): string {
  const money = (n: number): string => n.toFixed(2);
  const payload = [
    input.accountId,
    input.periodStart,
    input.periodEnd,
    money(input.openingBalance),
    money(input.closingBalance),
    ...(input.lines ?? []).map((line) =>
      [line.date, line.description ?? "", money(line.amount)].join("|"),
    ),
  ].join("\n");
  return createHash("sha256").update(payload).digest("hex");
}
