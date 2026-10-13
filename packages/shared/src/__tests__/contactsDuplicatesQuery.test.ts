import { describe, expect, it } from "vitest";
import { paginateContactDuplicatePairs } from "../contacts/contactsDuplicatesQuery.js";
import type { ContactDuplicatePair } from "../contacts/contactDuplicateUtils.js";

const pair = (id: string): ContactDuplicatePair => ({
  id,
  confidence: 90,
  reasonKey: "phone",
  contacts: [
    { id: "1", name: "A", firstName: "A" },
    { id: "2", name: "B", firstName: "B" },
  ],
});

describe("paginateContactDuplicatePairs", () => {
  it("pages duplicate pairs", () => {
    const all = [pair("a-b"), pair("c-d"), pair("e-f")];
    const page = paginateContactDuplicatePairs(all, 1, 2);
    expect(page.pairs).toHaveLength(2);
    expect(page.total).toBe(3);
    expect(page.hasMore).toBe(true);
  });
});
