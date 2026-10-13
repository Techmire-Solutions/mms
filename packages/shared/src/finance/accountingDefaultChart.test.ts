import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHART_CASH_ACCOUNT_CODE,
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_CHART_RETAINED_EARNINGS_CODE,
  DEFAULT_CHART_SECTIONS,
} from "./accountingDefaultChart.js";
import { accountRecordInsertSchema } from "./accountingModuleManifest.js";

describe("DEFAULT_CHART_OF_ACCOUNTS", () => {
  it("has unique 5-digit codes", () => {
    const codes = DEFAULT_CHART_OF_ACCOUNTS.map((account) => account.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^\d{5}$/);
  });

  it("places every account in the section whose type matches its code block", () => {
    for (const account of DEFAULT_CHART_OF_ACCOUNTS) {
      const code = Number(account.code);
      const section = DEFAULT_CHART_SECTIONS.find(
        (candidate) => code >= candidate.from && code <= candidate.to,
      );
      expect(section?.type, account.code).toBe(account.type);
    }
  });

  it("seeds every section", () => {
    for (const section of DEFAULT_CHART_SECTIONS) {
      const inSection = DEFAULT_CHART_OF_ACCOUNTS.filter(
        (account) => Number(account.code) >= section.from && Number(account.code) <= section.to,
      );
      expect(inSection.length, section.label).toBeGreaterThan(0);
    }
  });

  it("reserves the 10xxx block for cash and bank accounts", () => {
    const tenBlock = DEFAULT_CHART_OF_ACCOUNTS.filter((account) => account.code.startsWith("10"));
    for (const account of tenBlock)
      expect(`${account.name} ${account.subtype}`).toMatch(/cash|bank/i);
  });

  it("passes the account insert contract", () => {
    for (const account of DEFAULT_CHART_OF_ACCOUNTS) {
      expect(accountRecordInsertSchema.safeParse(account).success, account.code).toBe(true);
    }
  });

  it("names default-setting accounts that exist with the required types", () => {
    const byCode = new Map(DEFAULT_CHART_OF_ACCOUNTS.map((account) => [account.code, account]));
    expect(byCode.get(DEFAULT_CHART_RETAINED_EARNINGS_CODE)?.type).toBe("Equity");
    expect(byCode.get(DEFAULT_CHART_CASH_ACCOUNT_CODE)?.type).toBe("Asset");
  });
});
