import { describe, expect, it } from "vitest";
import {
  ACCOUNTING_SUB_TAB_IDS,
  ACCOUNTING_SUB_TAB_ICONS,
  ACCOUNTING_SUB_TAB_KEYS,
} from "./accountingPageSubTabs";
import { Landmark, CalendarCheck } from "lucide-react";

describe("accountingPageSubTabs registry", () => {
  it("includes banking and periodEnd in ACCOUNTING_SUB_TAB_IDS", () => {
    expect(ACCOUNTING_SUB_TAB_IDS).toContain("banking");
    expect(ACCOUNTING_SUB_TAB_IDS).toContain("periodEnd");
  });

  it("assigns Landmark icon to banking and CalendarCheck to periodEnd", () => {
    expect(ACCOUNTING_SUB_TAB_ICONS.banking).toBe(Landmark);
    expect(ACCOUNTING_SUB_TAB_ICONS.periodEnd).toBe(CalendarCheck);
  });

  it("maps keys to accounting.tabs.banking and accounting.tabs.periodEnd", () => {
    expect(ACCOUNTING_SUB_TAB_KEYS.banking).toBe("accounting.tabs.banking");
    expect(ACCOUNTING_SUB_TAB_KEYS.periodEnd).toBe("accounting.tabs.periodEnd");
  });
});
