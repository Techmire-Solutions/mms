import { describe, expect, it } from "vitest";
import {
  buildContactWriteSchema,
  contactWriteSchema,
  contactWireWriteSchema,
  collectContactWriteExtraFieldKeys,
} from "../schemas/contacts.dto.js";
import { contactsImportBodySchema } from "../schemas/contactsImport.dto.js";
import { parseContactsCsv } from "../contacts/contactsCsvParser.js";
import type { FieldConfig } from "../contacts/contactTypes.js";

/**
 * Exact shape `contactRowToRecord` (via the `mapChild*` mappers) returns from the
 * API. The edit form sends this object straight back, so it must stay valid for
 * the write DTOs — otherwise every edit of a populated contact 400s.
 */
const apiContact = {
  id: "c1",
  firstName: "Ali",
  lastName: "Khan",
  name: "Ali Khan",
  isSyed: false,
  tags: ["VIP"],
  tag: "VIP",
  whatsappStatus: "unknown",
  phones: [{ label: "Main", number: "03001234567", isPrimary: true, countryCode: "+92" }],
  emails: [{ label: "Primary", address: "a@b.c", isPrimary: true, isVerified: false }],
  addresses: [{ isPrimary: true, label: "Home", line1: "1 Main St", city: "Lahore" }],
  socials: [{ platform: "LinkedIn", url: "https://example.com" }],
  education: [{ id: "edu1", institution: "University", sortOrder: 0 }],
  relationshipContacts: [
    { name: "Sara", relationship: "Father", phone: "0300", contactId: "c2", inferenceDepth: 1 },
  ],
  activities: [{ id: "act1", type: "note", content: "Called", date: "2026-01-01" }],
  attachments: [
    { id: "att1", name: "x.pdf", type: "pdf", size: 10, url: "/x", date: "2026-01-01" },
  ],
};

describe("contactWriteSchema allowlist", () => {
  it("strips client soft-delete fields", () => {
    const parsed = contactWriteSchema.safeParse({
      firstName: "Ali",
      deletedAt: "2026-01-01T00:00:00.000Z",
      deletedBy: "u1",
      deletionReason: "x",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const data = parsed.data as Record<string, unknown>;
      expect(data).not.toHaveProperty("deletedAt");
      expect(data).not.toHaveProperty("deletedBy");
      expect(data).not.toHaveProperty("deletionReason");
      expect(data.firstName).toBe("Ali");
    }
  });

  it("rejects unknown top-level keys on the system-only schema", () => {
    const parsed = contactWriteSchema.safeParse({
      firstName: "Ali",
      evilPayload: true,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts Setup custom keys when included in the allowlist", () => {
    const schema = buildContactWriteSchema(["customNote"]);
    const parsed = schema.safeParse({
      firstName: "Ali",
      customNote: "hello",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((parsed.data as { customNote?: string }).customNote).toBe("hello");
    }
  });

  it("accepts notes, line1, address, and tag/tags scalar mirrors on the system schema", () => {
    const parsed = contactWriteSchema.safeParse({
      firstName: "Ali",
      notes: "Some notes",
      line1: "123 Main St",
      address: "123 Main St",
      city: "Karachi",
      tag: "VIP, Donor",
      tags: ["VIP", "Donor"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const data = parsed.data as Record<string, unknown>;
      expect(data.notes).toBe("Some notes");
      expect(data.line1).toBe("123 Main St");
      expect(data.address).toBe("123 Main St");
      expect(data.tag).toBe("VIP, Donor");
      expect(data.tags).toEqual(["VIP", "Donor"]);
    }
  });

  it("collectContactWriteExtraFieldKeys gathers enabled custom field keys", () => {
    const config = {
      version: 1,
      fields: {
        basic: [
          { key: "firstName", type: "text", label: "First", enabled: true, required: true },
          { key: "customNote", type: "text", label: "Note", enabled: true, required: false },
          { key: "disabledNote", type: "text", label: "Off", enabled: false, required: false },
        ],
      },
    } as unknown as FieldConfig;
    expect(collectContactWriteExtraFieldKeys(config)).toEqual(["customNote"]);
  });
});

describe("contactWireWriteSchema round-trips the API row shape", () => {
  it("accepts a contact exactly as the API returns it", () => {
    const parsed = contactWireWriteSchema.safeParse(apiContact);
    expect(parsed.success).toBe(true);
  });

  it("accepts relationship rows carrying email/gender from the CSV and vCard parsers", () => {
    const parsed = contactWireWriteSchema.safeParse({
      firstName: "Ali",
      relationshipContacts: [
        { name: "Sara", relationship: "Father", email: "s@x.c", gender: "Female" },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("drops client-supplied audit attribution and creation back-dating", () => {
    const parsed = contactWireWriteSchema.safeParse({
      firstName: "Ali",
      createdAt: "2000-01-01T00:00:00.000Z",
      createdBy: "admin-1",
      updatedBy: "admin-1",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const data = parsed.data as Record<string, unknown>;
    expect(data).not.toHaveProperty("createdAt");
    expect(data).not.toHaveProperty("createdBy");
    expect(data).not.toHaveProperty("updatedBy");
  });
});

describe("contacts CSV export → import round trip", () => {
  const csv = [
    "first_name,last_name,phone,relationship_contact,relationship_type,relationship_email,relationship_gender",
    "Ali,Khan,03001234567,Sara,Father,s@x.c,Female",
  ].join("\n");

  it("accepts the parsed relationship row on the queued import payload", () => {
    const { contacts, errors } = parseContactsCsv(csv);
    expect(errors).toEqual([]);
    expect(contacts[0]?.relationshipContacts?.[0]).toMatchObject({
      email: "s@x.c",
      gender: "Female",
    });
    expect(contactsImportBodySchema.safeParse({ contacts }).success).toBe(true);
  });

  it("accepts an imported contact when it is edited later", () => {
    const { contacts } = parseContactsCsv(csv);
    expect(contactWireWriteSchema.safeParse(contacts[0]).success).toBe(true);
  });
});
