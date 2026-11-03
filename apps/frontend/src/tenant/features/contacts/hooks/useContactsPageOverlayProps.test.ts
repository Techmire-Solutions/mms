import { describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/shared";
import { loadDrawerContactTarget } from "@/tenant/features/contacts/hooks/useContactsPageOverlayProps";

/**
 * R4-07: a network link to a contact the loaded directory page does not carry
 * must open the real record (or fail loudly) — never a synthesized blank contact.
 */
describe("loadDrawerContactTarget", () => {
  const loaded = { id: "c-1", firstName: "Aisha", name: "Aisha Khan" } as Contact;

  it("uses the loaded directory record when present", async () => {
    const fetchContact = vi.fn();
    const target = await loadDrawerContactTarget("c-1", [loaded], fetchContact);

    expect(target).toBe(loaded);
    expect(fetchContact).not.toHaveBeenCalled();
  });

  it("fetches a record the page does not carry", async () => {
    const fetched = { id: "c-9", firstName: "Bilal", name: "Bilal Khan" } as Contact;
    const target = await loadDrawerContactTarget("c-9", [loaded], async () => fetched);

    expect(target).toBe(fetched);
  });

  it("returns null instead of inventing a contact when the fetch fails", async () => {
    const target = await loadDrawerContactTarget("c-404", [loaded], async () => {
      throw new Error("not found");
    });

    expect(target).toBeNull();
  });

  it("returns null when the record no longer exists", async () => {
    const target = await loadDrawerContactTarget("c-404", [loaded], async () => null);
    expect(target).toBeNull();
  });
});
