import { describe, expect, it } from "vitest";
import { ContactsError, isContactsError } from "./errors.js";

describe("ContactsError", () => {
  it("carries the typed code and message", () => {
    const error = new ContactsError("conflict", "Contact is linked to a student");
    expect(error.code).toBe("conflict");
    expect(error.message).toBe("Contact is linked to a student");
    expect(error.name).toBe("ContactsError");
  });

  it("is recognised by the type guard", () => {
    expect(isContactsError(new ContactsError("not_found", "missing"))).toBe(true);
    expect(isContactsError(new Error("plain"))).toBe(false);
    expect(isContactsError(null)).toBe(false);
  });
});
