import { describe, expect, it } from "vitest";
import { AVAILABLE_FIELDS } from "@/lib/invoiceTemplateFields";
import { resolveField } from "@/lib/invoiceTemplateResolver";

/**
 * Token ↔ resolver parity for the printable obligation receipt.
 *
 * The field catalogue (what a designer can drop on the layout) and the resolver (what turns a saved
 * token into a value) were two lists that happened to match at 20 entries. Nothing enforced it: a
 * field removed from one side — or a branch renamed on the other — makes a printed receipt render a
 * blank token, which no type error and no existing test catches (audit T3).
 */

/** A complete receipt payload: every catalogue field must resolve to something non-empty from it. */
const collection: Record<string, unknown> = {
  id: "oc_1",
  receipt_no: "OB-2026-0001",
  received_date: "2026-10-24",
  sender_id: "c_1",
  reference_id: "c_2",
  amount: 50000,
  currency_id: "PKR",
  payment_mode: "Cash",
  obligation_type_id: "ot_khums",
  mujtahid_representative_id: "rep_1",
  received_by: "Admin Office",
};

const lookups = {
  contacts: [
    { id: "c_1", name: "Haji Ghulam", phone: "+92 300 1234567", email: "donor@example.com" },
    { id: "c_2", name: "Sayyid Kazim", phone: "+92 321 9876543", email: "ref@example.com" },
  ],
  users: [{ id: "u_1", name: "Admin Office" }],
  obligationTypes: [{ id: "ot_khums", name: "Khums" }],
  mujtahids: [{ id: "mj_1", name: "Ayatullah Sistani" }],
  reps: [{ id: "rep_1", name: "Sayyid Ja'far", mujtahid_id: "mj_1" }],
  currencies: [{ id: "PKR", symbol: "Rs", name: "Pakistani Rupee" }],
  branding: {
    madrasaName: "Al-Hujjah Madrasa",
    tagline: "Knowledge and light",
    primaryColor: "#0f766e",
    secondaryColor: "#0d9488",
    cornerStyle: "rounded",
    logoUrl: "",
    faviconUrl: "",
    footerText: "JazakAllah Khair",
    email: "office@alhujjah.example",
    phone: "+92 21 1234567",
    website: "https://alhujjah.example",
    legalName: "Al-Hujjah Madrasa Trust",
    registrationNumber: "REG-42",
    addressLine1: "12 Mubarak Road",
    addressLine2: "Gulshan",
    city: "Karachi",
    country: "Pakistan",
  },
};

const catalogueFields = AVAILABLE_FIELDS.map((field) => field.field);

describe("obligation receipt template tokens", () => {
  it("has a resolver case for every catalogue field", () => {
    for (const field of catalogueFields) {
      const value = resolveField(field, collection, lookups);
      expect(typeof value).toBe("string");
      expect(value.length, `no resolved value for "${field}"`).toBeGreaterThan(0);
    }
  });

  it("resolves every catalogue field to readable text, not a raw id", () => {
    for (const field of catalogueFields) {
      const value = resolveField(field, collection, lookups);
      // The resolver may legitimately fall back to an id, but with complete lookups it must not.
      expect(value, `"${field}" fell back to a raw identifier`).not.toMatch(
        /^(c_|u_|ot_|rep_|mj_)/,
      );
    }
  });

  it("returns an empty string for an unknown token instead of throwing", () => {
    // A layout saved by an older build may carry a token this build dropped; printing must not
    // crash the whole receipt because of one stale element.
    expect(resolveField("token_that_no_longer_exists", collection, lookups)).toBe("");
  });

  it("returns an empty string when there is no collection", () => {
    expect(resolveField(catalogueFields[0] ?? "receipt_no", null, lookups)).toBe("");
  });
});
