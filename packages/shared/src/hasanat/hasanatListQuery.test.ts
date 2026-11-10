import { describe, expect, it } from "vitest";
import {
  hasanatDistributionsPageResponseSchema,
  hasanatListQuerySchema,
  parseHasanatStatusFilter,
} from "./hasanatListQuery.js";

const CARD = {
  id: "hd1",
  batchId: "b1",
  denominationId: "d1",
  denominationName: "Gold",
  recipientType: "student" as const,
  recipientStudentId: "s1",
  recipientName: "Fatima",
  recipientClass: "Class A",
  quantity: 1,
  pointsSnapshot: 50,
  status: "active" as const,
  issuedDate: "2026-11-10",
  reason: "Hifz",
};

describe("hasanatListQuerySchema", () => {
  it("accepts a single status and a comma-separated list", () => {
    expect(hasanatListQuerySchema.parse({ status: "active" }).status).toBe("active");
    expect(hasanatListQuerySchema.parse({ status: "active,redeemed" }).status).toBe(
      "active,redeemed",
    );
    expect(hasanatListQuerySchema.parse({ status: "" }).status).toBe("");
    expect(hasanatListQuerySchema.parse({}).status).toBeUndefined();
  });

  it("rejects an unknown status token instead of matching nothing", () => {
    expect(() => hasanatListQuerySchema.parse({ status: "actve" })).toThrow(/active, redeemed/);
    expect(() => hasanatListQuerySchema.parse({ status: "active,bogus" })).toThrow();
  });

  it("rejects unknown query keys", () => {
    expect(() => hasanatListQuerySchema.parse({ bogus: "1" })).toThrow();
  });

  it("parses the wire string into typed statuses", () => {
    expect(parseHasanatStatusFilter("active, redeemed ,")).toEqual(["active", "redeemed"]);
    expect(parseHasanatStatusFilter(undefined)).toEqual([]);
    expect(parseHasanatStatusFilter("returned")).toEqual(["returned"]);
  });
});

describe("hasanatDistributionsPageResponseSchema", () => {
  it("round-trips a page and requires every envelope field", () => {
    const page = {
      distributions: [CARD],
      total: 1,
      page: 1,
      limit: 15,
      hasMore: false,
    };
    expect(hasanatDistributionsPageResponseSchema.parse(page)).toEqual(page);

    const { hasMore: _omitted, ...missingHasMore } = page;
    expect(() => hasanatDistributionsPageResponseSchema.parse(missingHasMore)).toThrow();
  });
});
