import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadContactChildMaps,
  loadContactChildMapsAggregated,
} from "../db/repositories/contactRepositoryHydrateChildren.js";

describe("Contact Child Hydration Aggregated & Fallback Pathways", () => {
  const originalEnv = process.env.MMS_DISABLE_AGGREGATED_CHILD_HYDRATION;

  beforeEach(() => {
    delete process.env.MMS_DISABLE_AGGREGATED_CHILD_HYDRATION;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MMS_DISABLE_AGGREGATED_CHILD_HYDRATION = originalEnv;
    } else {
      delete process.env.MMS_DISABLE_AGGREGATED_CHILD_HYDRATION;
    }
  });

  it("defaults to aggregated single-query hydration when tx.execute is available", async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      rows: [
        {
          contactId: "c1",
          phones: [
            { id: "p1", contactId: "c1", number: "+1234567890", isPrimary: true, sortOrder: 0 },
          ],
          emails: [
            {
              id: "e1",
              contactId: "c1",
              address: "user@example.com",
              isPrimary: true,
              sortOrder: 0,
            },
          ],
          addresses: [{ id: "a1", contactId: "c1", line1: "Main St", sortOrder: 0 }],
          tags: [{ id: "t1", contactId: "c1", name: "Alumni" }],
          socials: [{ id: "s1", contactId: "c1", platform: "linkedin", sortOrder: 0 }],
          educations: [{ id: "ed1", contactId: "c1", institution: "Seminary", sortOrder: 0 }],
          experiences: [{ id: "ex1", contactId: "c1", company: "Org", sortOrder: 0 }],
          skills: [{ id: "sk1", contactId: "c1", name: "Tajweed", sortOrder: 0 }],
          relationships: [{ id: "r1", contactId: "c1", name: "Father", sortOrder: 0 }],
          activities: [{ id: "act1", contactId: "c1", type: "call", sortOrder: 0 }],
          attachments: [{ id: "att1", contactId: "c1", name: "id.png", sortOrder: 0 }],
          bankDetails: [{ id: "bd1", contactId: "c1", bankName: "Bank", sortOrder: 0 }],
        },
      ],
    });

    const mockSelect = vi.fn();

    const tx = {
      execute: mockExecute,
      select: mockSelect,
    } as any;

    const result = await loadContactChildMaps(tx, "demo", ["c1"]);

    // Assert execute was called (single aggregated query)
    expect(mockExecute).toHaveBeenCalledTimes(1);
    // Assert select was NOT called (no N+1 parallel queries)
    expect(mockSelect).not.toHaveBeenCalled();

    // Verify maps are populated
    expect(result.phonesMap.get("c1")?.[0]?.number).toBe("+1234567890");
    expect(result.emailsMap.get("c1")?.[0]?.address).toBe("user@example.com");
    expect(result.tagsMap.get("c1")?.[0]?.name).toBe("Alumni");
    expect(result.bankDetailsMap.get("c1")?.[0]?.bankName).toBe("Bank");
  });

  it("loadContactChildMapsAggregated returns empty maps when contactIds is empty", async () => {
    const mockExecute = vi.fn();
    const tx = { execute: mockExecute } as any;

    const result = await loadContactChildMapsAggregated(tx, "demo", []);

    expect(mockExecute).not.toHaveBeenCalled();
    expect(result.phonesMap.size).toBe(0);
    expect(result.emailsMap.size).toBe(0);
    expect(result.tagsMap.size).toBe(0);
  });
});
