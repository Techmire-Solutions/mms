import { describe, expect, it } from "vitest";
import { contactHasEmail, contactHasPhone, type Contact } from "./contactEntityTypes.js";

const base: Contact = {
  id: "c1",
  firstName: "Test",
  lastName: "User",
  name: "Test User",
  type: "staff",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("contactHasPhone", () => {
  it("returns false for null and undefined", () => {
    expect(contactHasPhone(null)).toBe(false);
    expect(contactHasPhone(undefined)).toBe(false);
  });

  it("returns true for a non-empty scalar phone", () => {
    expect(contactHasPhone({ ...base, phone: "555-0100" })).toBe(true);
  });

  it("returns true for a non-empty phone list entry", () => {
    expect(contactHasPhone({ ...base, phones: [{ label: "mobile", number: "555-0100" }] })).toBe(
      true,
    );
  });

  it("returns false for missing, empty, or whitespace-only phone", () => {
    expect(contactHasPhone(base)).toBe(false);
    expect(contactHasPhone({ ...base, phone: "   " })).toBe(false);
    expect(contactHasPhone({ ...base, phones: [{ label: "mobile", number: "" }] })).toBe(false);
    expect(contactHasPhone({ ...base, phones: [{ label: "mobile", number: "  " }] })).toBe(false);
  });
});

describe("contactHasEmail", () => {
  it("returns false for null and undefined", () => {
    expect(contactHasEmail(null)).toBe(false);
    expect(contactHasEmail(undefined)).toBe(false);
  });

  it("returns true for a non-empty scalar email", () => {
    expect(contactHasEmail({ ...base, email: "test@example.com" })).toBe(true);
  });

  it("returns true for a non-empty email list entry", () => {
    expect(
      contactHasEmail({ ...base, emails: [{ label: "home", address: "test@example.com" }] }),
    ).toBe(true);
  });

  it("returns false for missing, empty, or whitespace-only email", () => {
    expect(contactHasEmail(base)).toBe(false);
    expect(contactHasEmail({ ...base, email: "  " })).toBe(false);
    expect(contactHasEmail({ ...base, emails: [{ label: "home", address: "" }] })).toBe(false);
    expect(contactHasEmail({ ...base, emails: [{ label: "home", address: "  " }] })).toBe(false);
  });
});
