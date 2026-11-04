import { describe, expect, it } from "vitest";
import type { StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";
import {
  dedupeRecipientsById,
  filterDisplayedRecipients,
  withAddedRecipient,
} from "./messageComposerRecipientsUtils";

function recipient(id: string, name = id): MessagingRecipient {
  return { id, name, phone: `+92300${id}`, email: `${id}@example.com` };
}

describe("dedupeRecipientsById", () => {
  it("keeps the first entry per contact id and preserves order", () => {
    const deduped = dedupeRecipientsById([
      recipient("c1", "Zaid"),
      recipient("c2", "Hira"),
      recipient("c1", "Zaid duplicate"),
      recipient("c3", "Ali"),
    ]);

    expect(deduped.map((r) => r.id)).toEqual(["c1", "c2", "c3"]);
    expect(deduped[0]?.name).toBe("Zaid");
  });

  it("treats numeric and string ids as the same contact", () => {
    const deduped = dedupeRecipientsById([
      { id: 7, name: "Numeric", phone: "+923000000007" },
      { id: "7", name: "String", phone: "+923000000007" },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.name).toBe("Numeric");
  });

  it("returns an empty list for empty input", () => {
    expect(dedupeRecipientsById([])).toEqual([]);
  });
});

describe("withAddedRecipient", () => {
  it("refuses a duplicate instead of appending it", () => {
    const { next, duplicate } = withAddedRecipient([recipient("c1")], recipient("c1"));

    expect(duplicate).toBe(true);
    expect(next).toHaveLength(1);
  });
});

describe("filterDisplayedRecipients", () => {
  it("searches name, phone and email", () => {
    const rows = [
      { ...recipient("c1", "Zaid Khan"), isValid: true, address: "+923001" },
      { ...recipient("c2", "Hira"), isValid: false, reason: "missing_phone" },
    ];

    expect(
      filterDisplayedRecipients({
        recipientTab: "all",
        recipientSearch: "zaid",
        eligible: rows,
        skipped: [],
        validated: rows,
      }).map((r) => r.id),
    ).toEqual(["c1"]);
  });
});
