import { describe, expect, it, vi } from "vitest";
import { type Account } from "@mms/shared";
import {
  accountFxInsertValues,
  accountFxUpdateSet,
  applyExplicitAccountFxFlags,
} from "../db/repositories/accountingAccountsFxPersist.js";
import type { TenantTransaction } from "../db/tenant-context.js";

describe("accountingAccountsFxPersist", () => {
  describe("accountFxInsertValues", () => {
    it("uses explicit values when provided", () => {
      const account: Account = {
        id: "acc-1",
        code: "1000",
        name: "USD Bank",
        type: "Asset",
        subtype: "Cash",
        description: "",
        isActive: true,
        isMonetary: true,
        accountCurrency: "USD",
        allowRevaluation: false,
      };

      const result = accountFxInsertValues(account);
      expect(result).toEqual({
        isMonetary: true,
        accountCurrency: "USD",
        allowRevaluation: false,
      });
    });

    it("falls back to inferred and default values when omitted", () => {
      const account: Account = {
        id: "acc-2",
        code: "4000",
        name: "Revenue",
        type: "Revenue",
        subtype: "",
        description: "",
        isActive: true,
      };

      const result = accountFxInsertValues(account);
      expect(result.isMonetary).toBe(false);
      expect(result.accountCurrency).toBeNull();
      expect(result.allowRevaluation).toBe(true);
    });
  });

  describe("accountFxUpdateSet", () => {
    it("returns only defined fx fields", () => {
      expect(accountFxUpdateSet({})).toEqual({});
      expect(accountFxUpdateSet({ isMonetary: true })).toEqual({ isMonetary: true });
      expect(accountFxUpdateSet({ accountCurrency: "EUR" })).toEqual({ accountCurrency: "EUR" });
      expect(accountFxUpdateSet({ allowRevaluation: false })).toEqual({ allowRevaluation: false });
      expect(
        accountFxUpdateSet({
          isMonetary: false,
          accountCurrency: null,
          allowRevaluation: true,
        }),
      ).toEqual({
        isMonetary: false,
        accountCurrency: null,
        allowRevaluation: true,
      });
    });
  });

  describe("applyExplicitAccountFxFlags", () => {
    it("returns early when no records have fx fields", async () => {
      const tx = { execute: vi.fn() } as unknown as TenantTransaction;
      const records: Account[] = [
        {
          id: "acc-1",
          code: "1000",
          name: "Cash",
          type: "Asset",
          subtype: "",
          description: "",
          isActive: true,
        },
      ];

      await applyExplicitAccountFxFlags(tx, "test-subdomain", records);
      expect(tx.execute).not.toHaveBeenCalled();
    });

    it("executes update with cast parameters when records have fx fields", async () => {
      const execute = vi.fn().mockResolvedValue([]);
      const tx = { execute } as unknown as TenantTransaction;
      const records: Account[] = [
        {
          id: "acc-1",
          code: "1000",
          name: "USD Cash",
          type: "Asset",
          subtype: "",
          description: "",
          isActive: true,
          isMonetary: true,
          accountCurrency: "USD",
          allowRevaluation: true,
        },
      ];

      await applyExplicitAccountFxFlags(tx, "test-subdomain", records);
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });
});
