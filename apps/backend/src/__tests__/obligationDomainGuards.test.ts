import { describe, expect, it } from "vitest";
import type { ObligationDistribution, WakalaType } from "@mms/shared";
import {
  assertNoCascadingLoss,
  assertReceiptHasWakala,
  assertSplitRulesComplete,
  findWakalaForReceipt,
  splitRuleTotalBasisPoints,
} from "../obligations/domain/obligationWriteGuards.js";
import { ConflictError, ValidationError } from "../lib/httpErrors.js";

function wakala(overrides: Partial<WakalaType> = {}): WakalaType {
  return {
    id: "wt-1",
    mujtahid_representative_id: "rep-1",
    obligation_type_id: "ot-1",
    ...overrides,
  };
}

function rule(overrides: Partial<ObligationDistribution> = {}): ObligationDistribution {
  return {
    id: "od-1",
    name: "Sahm Imam",
    percentage: 60,
    wakala_type_id: "wt-1",
    type: "Income",
    account_id: null,
    ...overrides,
  };
}

describe("findWakalaForReceipt", () => {
  it("matches on the type and representative pair", () => {
    const found = findWakalaForReceipt(
      { obligation_type_id: "ot-1", mujtahid_representative_id: "rep-1" },
      [wakala()],
    );
    expect(found?.id).toBe("wt-1");
  });

  it("returns null when either half of the pair differs", () => {
    expect(
      findWakalaForReceipt({ obligation_type_id: "ot-2", mujtahid_representative_id: "rep-1" }, [
        wakala(),
      ]),
    ).toBeNull();
    expect(
      findWakalaForReceipt({ obligation_type_id: "ot-1", mujtahid_representative_id: "rep-2" }, [
        wakala(),
      ]),
    ).toBeNull();
  });
});

describe("assertReceiptHasWakala", () => {
  it("accepts a receipt whose pair has a wakala", () => {
    expect(() =>
      assertReceiptHasWakala({ obligation_type_id: "ot-1", mujtahid_representative_id: "rep-1" }, [
        wakala(),
      ]),
    ).not.toThrow();
  });

  it("rejects a receipt whose pair has no wakala, before anything is written", () => {
    // Without this the receipt saved and the posting engine credited 100 % to income.
    expect(() =>
      assertReceiptHasWakala({ obligation_type_id: "ot-1", mujtahid_representative_id: "rep-9" }, [
        wakala(),
      ]),
    ).toThrow(ValidationError);
    expect(() =>
      assertReceiptHasWakala({ obligation_type_id: "ot-1", mujtahid_representative_id: "rep-9" }, [
        wakala(),
      ]),
    ).toThrow(/no wakala is configured/i);
  });
});

describe("splitRuleTotalBasisPoints", () => {
  it("sums exactly in hundredths of a percent", () => {
    expect(
      splitRuleTotalBasisPoints([
        { percentage: 33.33 },
        { percentage: 33.33 },
        { percentage: 33.34 },
      ]),
    ).toBe(10_000);
    expect(splitRuleTotalBasisPoints([{ percentage: 60 }, { percentage: 40 }])).toBe(10_000);
  });
});

describe("assertSplitRulesComplete", () => {
  it("accepts a complete set and an empty set", () => {
    expect(() =>
      assertSplitRulesComplete([wakala()], [rule(), rule({ id: "od-2", percentage: 40 })]),
    ).not.toThrow();
    // No rules yet is the documented "not configured" state, not an error.
    expect(() => assertSplitRulesComplete([wakala()], [])).not.toThrow();
  });

  it("accepts the awkward thirds that only total exactly in basis points", () => {
    expect(() =>
      assertSplitRulesComplete(
        [wakala()],
        [
          rule({ id: "a", percentage: 33.33 }),
          rule({ id: "b", percentage: 33.33 }),
          rule({ id: "c", percentage: 33.34 }),
        ],
      ),
    ).not.toThrow();
  });

  it("rejects an incomplete set and names the wakala and its total", () => {
    expect(() =>
      assertSplitRulesComplete(
        [wakala()],
        [rule({ percentage: 60 }), rule({ id: "od-2", percentage: 20 })],
      ),
    ).toThrow(/80\.00.*expected 100%/i);
  });

  it("rejects an over-allocated set", () => {
    expect(() =>
      assertSplitRulesComplete(
        [wakala()],
        [rule({ percentage: 90 }), rule({ id: "od-2", percentage: 90 })],
      ),
    ).toThrow(ValidationError);
  });

  it("judges each wakala independently", () => {
    const other = wakala({ id: "wt-2", obligation_type_id: "ot-2" });
    expect(() =>
      assertSplitRulesComplete(
        [wakala(), other],
        [rule({ percentage: 100 }), rule({ id: "od-3", percentage: 100, wakala_type_id: "wt-2" })],
      ),
    ).not.toThrow();
  });
});

describe("assertNoCascadingLoss", () => {
  it("allows a delete with no dependents", () => {
    expect(() =>
      assertNoCascadingLoss("representative", ["rep-9"], {
        wakalaTypes: 0,
        distributions: 0,
        receipts: 0,
      }),
    ).not.toThrow();
  });

  it("refuses the delete and reports what would cascade", () => {
    // PUT /mujtahids/bulk with a shortened list used to wipe wakalas and their split rules.
    expect(() =>
      assertNoCascadingLoss("mujtahid", ["m1"], {
        wakalaTypes: 2,
        distributions: 3,
        receipts: 0,
      }),
    ).toThrow(ConflictError);
    expect(() =>
      assertNoCascadingLoss("mujtahid", ["m1"], {
        wakalaTypes: 2,
        distributions: 3,
        receipts: 0,
      }),
    ).toThrow(/2 wakala type\(s\) and 3 distribution rule\(s\)/);
  });

  it("truncates a long id list and counts the rest", () => {
    expect(() =>
      assertNoCascadingLoss("wakala type", ["a", "b", "c", "d", "e", "f", "g"], {
        wakalaTypes: 0,
        distributions: 4,
        receipts: 0,
      }),
    ).toThrow(/\(\+2 more\)/);
  });
});
