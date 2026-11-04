import { describe, expect, it } from "vitest";
import { CONTACTS_IMPORT_MAX_CONTACTS, CONTACTS_IMPORT_MAX_FILE_BYTES } from "@mms/shared";
import {
  readAndParseAppleContactsFile,
  type ParseAppleContactsResult,
} from "./appleContactsFileParser";

const OPTIONS = {
  mobileLabel: "Mobile",
  personalLabel: "Personal",
  defaultPhoneCountryCode: "+92",
};

function vcard(name: string, phone: string): string {
  return ["BEGIN:VCARD", "VERSION:3.0", `FN:${name}`, `TEL;TYPE=CELL:${phone}`, "END:VCARD"].join(
    "\n",
  );
}

function parse(file: File): Promise<ParseAppleContactsResult> {
  return new Promise((resolve) => {
    readAndParseAppleContactsFile(file, OPTIONS, resolve);
  });
}

describe("readAndParseAppleContactsFile", () => {
  it("parses a normal vCard file", async () => {
    const file = new File([vcard("Aisha Khan", "+923001234567")], "contacts.vcf", {
      type: "text/vcard",
    });

    const result = await parse(file);

    expect(result.limit).toBeUndefined();
    expect(result.parsed).toHaveLength(1);
  });

  it("rejects an oversized file before reading it", async () => {
    const file = new File([new Uint8Array(CONTACTS_IMPORT_MAX_FILE_BYTES + 1)], "huge.vcf", {
      type: "text/vcard",
    });

    const result = await parse(file);

    expect(result.parsed).toEqual([]);
    expect(result.limit).toEqual({
      kind: "file_too_large",
      limitMb: Math.round(CONTACTS_IMPORT_MAX_FILE_BYTES / (1024 * 1024)),
    });
  });

  it("rejects a file with more contacts than the import cap", async () => {
    const rows = Array.from({ length: CONTACTS_IMPORT_MAX_CONTACTS + 1 }, (_, index) =>
      vcard(`Person ${index}`, `+92300${String(index).padStart(7, "0")}`),
    ).join("\n");
    const file = new File([rows], "too-many.vcf", { type: "text/vcard" });

    const result = await parse(file);

    expect(result.parsed).toEqual([]);
    expect(result.limit).toEqual({
      kind: "too_many_contacts",
      count: CONTACTS_IMPORT_MAX_CONTACTS + 1,
      limit: CONTACTS_IMPORT_MAX_CONTACTS,
    });
  });
});
