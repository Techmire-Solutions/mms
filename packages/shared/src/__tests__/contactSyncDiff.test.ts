import { describe, expect, it } from "vitest";
import type { Contact } from "../contacts/contactTypes.js";
import {
  diffContactForSync,
  mergeContactForSync,
  resolveSyncConflictContactId,
} from "../contacts/contactSyncDiff.js";

const base: Contact = {
  id: "1",
  name: "Ali Khan",
  firstName: "Ali",
  lastName: "Khan",
  gender: "male",
  phone: "+923001234567",
  email: "ali@example.com",
  city: "Lahore",
  phones: [{ number: "+923001234567", label: "mobile" }],
  emails: [{ address: "ali@example.com", label: "personal" }],
  addresses: [{ city: "Lahore", label: "home" }],
};

describe("diffContactForSync", () => {
  it("returns diffs when server differs", () => {
    const server = { ...base, city: "Karachi", addresses: [{ city: "Karachi", label: "home" }] };
    const diffs = diffContactForSync(base, server);
    expect(diffs.some((d) => d.field === "city")).toBe(true);
    expect(diffs.find((d) => d.field === "city")?.server).toBe("Karachi");
  });

  it("returns empty when server matches", () => {
    expect(diffContactForSync(base, { ...base })).toEqual([]);
  });

  it("handles missing server contact", () => {
    const diffs = diffContactForSync(base, undefined);
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs[0]?.server).toBe("—");
  });
});

describe("resolveSyncConflictContactId", () => {
  it("resolves update contact id", () => {
    expect(resolveSyncConflictContactId({ kind: "update", contactId: "42", contact: base })).toBe(
      "42",
    );
  });

  it("resolves upsert from contact", () => {
    expect(resolveSyncConflictContactId({ kind: "upsert", contact: base })).toBe("1");
  });
});

describe("mergeContactForSync", () => {
  it("merges picked fields from local and server", () => {
    const server = { ...base, firstName: "Aisha", gender: "female" };
    const merged = mergeContactForSync(base, server, { firstName: "local", gender: "server" });
    expect(merged.firstName).toBe("Ali");
    expect(merged.gender).toBe("female");
  });

  it("applies cleared phone/email/address collections from local", () => {
    const local = {
      ...base,
      phones: [],
      phone: "",
      emails: [],
      email: "",
      addresses: [],
      city: "",
    } as Contact;
    const merged = mergeContactForSync(local, base, {
      phone: "local",
      email: "local",
      city: "local",
    });
    expect(merged.phones).toEqual([]);
    expect(merged.phone).toBe("");
    expect(merged.emails).toEqual([]);
    expect(merged.email).toBe("");
    expect(merged.addresses).toEqual([]);
    expect(merged.city).toBe("");
  });
});
