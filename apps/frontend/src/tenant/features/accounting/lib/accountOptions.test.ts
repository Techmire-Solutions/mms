import { describe, expect, it } from "vitest";
import type { Account } from "@mms/shared";
import { accountOptions } from "./accountOptions";

const account = (overrides: Partial<Account> & Pick<Account, "id" | "code" | "name">): Account =>
  ({
    type: "Asset",
    subtype: "Current Assets",
    description: "",
    isActive: true,
    ...overrides,
  }) as Account;

const accounts: Account[] = [
  account({ id: "parent", code: "1000", name: "Current Assets" }),
  account({ id: "cash", code: "1010", name: "Cash", parentId: "parent" }),
  account({ id: "inactive", code: "1020", name: "Old Bank", isActive: false }),
  account({ id: "revenue", code: "4000", name: "Fees", type: "Revenue" }),
];

describe("accountOptions", () => {
  it("excludes header/summary accounts and inactive rows from postable options", () => {
    // Posting to a header is rejected by the API, so the picker must not offer it.
    expect(accountOptions(accounts).map((option) => option.value)).toEqual(["cash", "revenue"]);
  });

  it("still filters by type and sorts by code", () => {
    expect(accountOptions(accounts, "Asset").map((option) => option.value)).toEqual(["cash"]);
    expect(accountOptions(accounts, ["Revenue", "Asset"]).map((option) => option.value)).toEqual([
      "cash",
      "revenue",
    ]);
  });
});
