import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/shared";

const mockLoadContactRuntimeDefaults = vi.fn();
const mockLoadContactLookupKind = vi.fn();

vi.mock("../contacts/use-cases/contactLoadUseCases.js", () => ({
  loadContactRuntimeDefaults: () => mockLoadContactRuntimeDefaults(),
}));

vi.mock("../contacts/use-cases/contactLookupsService.js", () => ({
  loadContactLookupKind: (...args: unknown[]) => mockLoadContactLookupKind(...args),
}));

import {
  mergeContactPatch,
  prepareContactRecord,
  stripClientSoftDeleteFields,
} from "../contacts/use-cases/contactValidationUseCases.js";

function fakeContact(id: string, overrides: Partial<Contact> = {}): Contact {
  return {
    id,
    name: `Contact ${id}`,
    firstName: "Contact",
    lastName: id,
    relationshipContacts: [],
    relationships: [],
    ...overrides,
  };
}

describe("contactValidationUseCases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadContactRuntimeDefaults.mockResolvedValue({
      defaultPhoneCountryCode: "+92",
      phoneLabel: "Mobile",
    });
    mockLoadContactLookupKind.mockImplementation(async (kind: string) =>
      kind === "countryCodes" ? [{ code: "+92" }] : [],
    );
  });

  describe("mergeContactPatch", () => {
    it("merges defined patch keys onto existing", () => {
      const existing = fakeContact("c1", { firstName: "Ali" });
      const next = mergeContactPatch(
        existing,
        fakeContact("c1", { firstName: "Aisha", name: "Aisha Khan" }),
      );
      expect(next.firstName).toBe("Aisha");
      expect(next.name).toBe("Aisha Khan");
      expect(next.id).toBe("c1");
    });

    it("ignores undefined patch values", () => {
      const existing = fakeContact("c1", { firstName: "Ali" });
      const next = mergeContactPatch(existing, {
        ...fakeContact("c1"),
        firstName: undefined,
      } as unknown as Contact);
      expect(next.firstName).toBe("Ali");
    });

    it("does not mutate the existing record", () => {
      const existing = fakeContact("c1", { firstName: "Ali" });
      mergeContactPatch(existing, fakeContact("c1", { firstName: "Aisha" }));
      expect(existing.firstName).toBe("Ali");
    });
  });

  describe("stripClientSoftDeleteFields", () => {
    it("removes the soft-delete keys", () => {
      const input = fakeContact("c1", {
        deletedAt: "2026-07-27T00:00:00.000Z",
        deletedBy: "u-admin",
        deletionReason: "Duplicate",
      });
      const stripped = stripClientSoftDeleteFields(input);
      expect(stripped.deletedAt).toBeUndefined();
      expect(stripped.deletedBy).toBeUndefined();
      expect(stripped.deletionReason).toBeUndefined();
    });
  });

  describe("prepareContactRecord", () => {
    it("normalizes phone rows to E.164 with the runtime country default", async () => {
      const contact = fakeContact("c1", {
        phones: [{ label: "Mobile", number: "300 1234567", countryCode: "", isPrimary: true }],
      });
      const prepared = await prepareContactRecord(contact, "c1");
      expect(prepared.phones?.[0]).toMatchObject({
        number: "3001234567",
        countryCode: "+92",
      });
    });

    it("rebuilds a phone row from the scalar phone when phones is absent", async () => {
      const contact = fakeContact("c1", { phones: undefined, phone: "3001234567" });
      const prepared = await prepareContactRecord(contact, "c1");
      expect(prepared.phones).toHaveLength(1);
      expect(prepared.phones?.[0]).toMatchObject({
        number: "3001234567",
        countryCode: "+92",
        isPrimary: true,
      });
    });

    it("leaves an explicit phones: [] as-is (clear, not rebuilt)", async () => {
      const contact = fakeContact("c1", { phones: [], phone: "3001234567" });
      const prepared = await prepareContactRecord(contact, "c1");
      expect(prepared.phones).toEqual([]);
    });

    it("syncs the scalar phone from the primary row", async () => {
      const contact = fakeContact("c1", {
        phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92", isPrimary: true }],
      });
      const prepared = await prepareContactRecord(contact, "c1");
      expect(prepared.phone).toBe("+92 3001234567");
    });

    it("applies title-case to name fields", async () => {
      const contact = fakeContact("c1", { firstName: "ali", lastName: "khan", name: "ali khan" });
      const prepared = await prepareContactRecord(contact, "c1");
      expect(prepared.firstName).toBe("Ali");
      expect(prepared.lastName).toBe("Khan");
      expect(prepared.name).toBe("Ali Khan");
    });

    it("strips retired classification fields", async () => {
      const contact = fakeContact("c1", {
        persona: "student",
        lifecycleStage: "lead",
        tag: "VIP",
      });
      const prepared = await prepareContactRecord(contact, "c1");
      expect(prepared.persona).toBeUndefined();
      expect(prepared.lifecycleStage).toBeUndefined();
      expect((prepared as any).tag).toBeUndefined();
      expect(prepared.tags).toEqual(["VIP"]);
    });

    it("uses the explicit id and falls back to a temp id otherwise", async () => {
      const prepared = await prepareContactRecord(fakeContact("c1"), "explicit-id");
      expect(prepared.id).toBe("explicit-id");
      const noId = { ...fakeContact("c1"), id: undefined } as unknown as Contact;
      const temp = await prepareContactRecord(noId);
      expect(String(temp.id)).toMatch(/^temp-/);
    });

    it("falls back to contact id or temp id when id is blank or whitespace", async () => {
      const blankExplicit = await prepareContactRecord(fakeContact("c1"), "   ");
      expect(blankExplicit.id).toBe("c1");
      const emptyBoth = await prepareContactRecord(
        { ...fakeContact(""), id: "" } as unknown as Contact,
        "   ",
      );
      expect(String(emptyBoth.id)).toMatch(/^temp-/);
      const emptyContactId = { ...fakeContact(""), id: "" } as unknown as Contact;
      const tempEmpty = await prepareContactRecord(emptyContactId);
      expect(String(tempEmpty.id)).toMatch(/^temp-/);
    });
  });
});
