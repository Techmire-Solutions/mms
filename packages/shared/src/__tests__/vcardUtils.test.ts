import { describe, expect, it } from "vitest";
import { parseVCard, toVCard } from "../vcardUtils.js";
import type { Contact } from "../contactTypes.js";

describe("vcardUtils", () => {
  it("serializes contact to vCard 3.0 string", () => {
    const contact: Contact = {
      id: "test-1",
      name: "Syed Ali",
      firstName: "Syed",
      lastName: "Ali",
      phones: [{ label: "Mobile", countryCode: "+92", number: "3001234567" }],
      emails: [{ label: "Personal", address: "ali@example.com" }],
      employer: "Madrasa Tech",
      designation: "Administrator",
      notes: "Key contact",
      dob: "1995-05-15",
    };

    const vcf = toVCard(contact);

    expect(vcf).toContain("BEGIN:VCARD");
    expect(vcf).toContain("VERSION:3.0");
    expect(vcf).toContain("FN:Syed Ali");
    expect(vcf).toContain("N:Ali;Syed;;;");
    expect(vcf).toContain("TEL;TYPE=MOBILE:3001234567");
    expect(vcf).toContain("EMAIL;TYPE=PERSONAL:ali@example.com");
    expect(vcf).toContain("ORG:Madrasa Tech");
    expect(vcf).toContain("TITLE:Administrator");
    expect(vcf).toContain("NOTE:Key contact");
    expect(vcf).toContain("BDAY:19950515");
    expect(vcf).toContain("END:VCARD");
  });

  it("parses vCard string into Contact objects", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Syed Ali",
      "N:Ali;Syed;;;",
      "TEL;TYPE=CELL:+923001234567",
      "EMAIL;TYPE=INTERNET:ali@example.com",
      "ORG:Madrasa Tech;IT",
      "TITLE:Administrator",
      "NOTE:Key contact",
      "BDAY:19950515",
      "END:VCARD",
    ].join("\r\n");

    const result = parseVCard(vcf);

    expect(result).toHaveLength(1);
    const parsed = result[0];
    expect(parsed.name).toBe("Syed Ali");
    expect(parsed.firstName).toBe("Syed");
    expect(parsed.lastName).toBe("Ali");
    expect(parsed.phones).toEqual([{ label: "Mobile", countryCode: "+92", number: "3001234567" }]);
    expect(parsed.emails).toEqual([{ label: "Personal", address: "ali@example.com" }]);
    expect(parsed.employer).toBe("Madrasa Tech");
    expect(parsed.designation).toBe("Administrator");
    expect(parsed.notes).toBe("Key contact");
    expect(parsed.dob).toBe("1995-05-15");
  });

  it("handles empty or malformed vCards gracefully", () => {
    expect(parseVCard("")).toEqual([]);
    expect(parseVCard("INVALID CONTENT")).toEqual([]);
  });

  it("does not invent a country code for local phone numbers", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Local Contact",
      "TEL;TYPE=CELL:03001234567",
      "END:VCARD",
    ].join("\r\n");

    expect(parseVCard(vcf)[0]?.phones).toEqual([
      { label: "Mobile", countryCode: "", number: "03001234567" },
    ]);
  });
});
