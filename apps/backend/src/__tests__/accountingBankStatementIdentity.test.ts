import { describe, expect, it } from "vitest";
import { bankStatementContentHash } from "../db/repositories/accountingBankStatementIdentity.js";

const statement = {
  accountId: "bank-1",
  periodStart: "2026-01-01",
  periodEnd: "2026-01-31",
  openingBalance: 100,
  closingBalance: 130,
  lines: [
    { date: "2026-01-05", description: "deposit", amount: 50 },
    { date: "2026-01-10", description: "withdrawal", amount: -20 },
  ],
};

describe("bankStatementContentHash", () => {
  it("is stable for identical economic content", () => {
    expect(bankStatementContentHash(statement)).toBe(bankStatementContentHash({ ...statement }));
  });

  it("ignores identity and timestamp fields", () => {
    const a = bankStatementContentHash({ ...statement, id: "bs-1", createdAt: "x" } as never);
    const b = bankStatementContentHash({ ...statement, id: "bs-2", createdAt: "y" } as never);
    expect(a).toBe(b);
  });

  it("differs when the account or period changes", () => {
    expect(bankStatementContentHash({ ...statement, accountId: "bank-2" })).not.toBe(
      bankStatementContentHash(statement),
    );
    expect(bankStatementContentHash({ ...statement, periodEnd: "2026-02-28" })).not.toBe(
      bankStatementContentHash(statement),
    );
  });

  it("differs when a line amount or date changes", () => {
    expect(
      bankStatementContentHash({
        ...statement,
        lines: [{ date: "2026-01-05", description: "deposit", amount: 51 }],
      }),
    ).not.toBe(bankStatementContentHash(statement));
  });
});
