import { describe, expect, it } from "vitest";
import { toTitleCase } from "./titleCaseStringUtils.js";
import {
  calcAge,
  getSolarAgeComponents,
  isValidCalendarIsoDate,
  isValidDobIsoDate,
} from "./ageUtils.js";
import {
  buildContactDuplicateCheckBodySchema,
  contactWriteSchema,
} from "../schemas/contacts.dto.js";
import { findContactDuplicatePairs } from "../contacts/contactDuplicateUtils.js";
import { cleanContactDraft } from "../contacts/contactItemNormalize.js";
import { overlayLookupOptionsOnFields } from "../contacts/contactLookupTypes.js";
import { getProvincesForCountry } from "./countryProvinces.js";
import type { Contact } from "../contacts/contactTypes.js";

describe("Contacts & shared contract regressions", () => {
  describe("toTitleCase", () => {
    it("preserves intentional uppercase acronyms and mixed-case tokens", () => {
      expect(toTitleCase("Test QA")).toBe("Test QA");
      expect(toTitleCase("McDonald PhD")).toBe("McDonald PhD");
      expect(toTitleCase("john doe")).toBe("John Doe");
      expect(toTitleCase("syed ali of karachi")).toBe("Syed Ali of Karachi");
    });
  });

  describe("DOB validation and age bounds", () => {
    it("rejects impossible calendar dates and pre-1900 legacy dates", () => {
      expect(isValidCalendarIsoDate("9999-99-99")).toBe(false);
      expect(isValidCalendarIsoDate("2026-02-30")).toBe(false);
      expect(isValidCalendarIsoDate("2000-05-15")).toBe(true);

      expect(isValidDobIsoDate("0111-01-05")).toBe(false);
      expect(isValidDobIsoDate("2999-01-01")).toBe(false);
      expect(isValidDobIsoDate("1995-03-20")).toBe(true);

      expect(calcAge("0111-01-05")).toBeNull();
      expect(getSolarAgeComponents("0111-01-05")).toBeNull();
    });
  });

  describe("buildContactDuplicateCheckBodySchema", () => {
    it("accepts partial drafts with incomplete phone numbers and missing firstName without 400", () => {
      const schema = buildContactDuplicateCheckBodySchema();
      const res = schema.safeParse({
        contact: {
          phones: [{ label: "Mobile", number: "12", countryCode: "+92" }],
        },
      });
      expect(res.success).toBe(true);
    });
  });

  describe("findContactDuplicatePairs", () => {
    const mk = (id: string, overrides: Partial<Contact>): Contact => ({
      id,
      firstName: "Ali",
      name: "Ali Khan",
      ...overrides,
    });

    it("suppresses name-only false positives when phones or emails conflict", () => {
      const a = mk("1", { phones: [{ label: "Mobile", number: "03001112222" }] });
      const b = mk("2", { phones: [{ label: "Mobile", number: "03009998888" }] });
      expect(findContactDuplicatePairs([a, b])).toHaveLength(0);
    });

    it("excludes persisted dismissedDuplicatePairs", () => {
      const a = mk("1", { phones: [{ label: "Mobile", number: "03001112222" }] });
      const b = mk("2", { phones: [{ label: "Mobile", number: "03001112222" }] });
      expect(findContactDuplicatePairs([a, b])).toHaveLength(1);
      expect(findContactDuplicatePairs([a, b], { dismissedDuplicatePairs: ["1-2"] })).toHaveLength(
        0,
      );
    });

    it("suppresses name-only false positives when CNIC is asymmetric", () => {
      const a = mk("1", { cnic: "42101-1234567-1" });
      const b = mk("2", { cnic: "" });
      expect(findContactDuplicatePairs([a, b])).toHaveLength(0);
    });
  });

  describe("overlayLookupOptionsOnFields", () => {
    it("overlays custom tenant gender options onto the gender field definition", () => {
      const baseFields = {
        basic: [
          {
            key: "gender",
            options: ["Male", "Female"],
          },
        ],
      };
      const merged = overlayLookupOptionsOnFields(baseFields, {
        genders: ["Male", "Female", "Prefer Not to Say"],
      });
      expect(merged.basic?.[0]?.options).toEqual(["Male", "Female", "Prefer Not to Say"]);
    });
  });

  describe("cleanContactDraft & contactWriteSchema", () => {
    it("strips transient id and _localId keys and drops blank rows cleanly", () => {
      const cleaned = cleanContactDraft({
        firstName: "Test QA",
        gender: "Male",
        phones: [
          {
            id: "tmp-1",
            _localId: "loc-1",
            label: "Mobile",
            number: "03001234567",
            countryCode: "+92",
          },
          { id: "tmp-2", _localId: "loc-2", label: "Mobile", number: "", countryCode: "+92" },
        ],
        emails: [
          { id: "e-1", _localId: "eloc-1", label: "Personal", address: "qa@example.com" },
          { id: "e-2", _localId: "eloc-2", label: "Work", address: "" },
        ],
      });
      expect(cleaned.phones).toHaveLength(1);
      expect(cleaned.phones?.[0]).not.toHaveProperty("_localId");
      expect(cleaned.phones?.[0]).not.toHaveProperty("id");
      expect(cleaned.emails).toHaveLength(1);
      expect(cleaned.emails?.[0]).not.toHaveProperty("_localId");
      expect(cleaned.emails?.[0]).not.toHaveProperty("id");

      const parsed = contactWriteSchema.safeParse(cleaned);
      expect(parsed.success).toBe(true);
    });
  });

  describe("getProvincesForCountry", () => {
    it("returns provinces for known countries case-insensitively and empty array for unknown", () => {
      expect(getProvincesForCountry("Pakistan")).toContain("Sindh");
      expect(getProvincesForCountry("pakistan")).toContain("Punjab");
      expect(getProvincesForCountry("United States")).toContain("California");
      expect(getProvincesForCountry("Atlantis")).toEqual([]);
    });
  });
});
