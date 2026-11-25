import { describe, expect, it } from "vitest";
import {
  CONTACTS_MODULE_MANIFEST,
  contactRecordSchema,
  contactListSchema,
} from "./contactsModuleManifest.js";

describe("CONTACTS_MODULE_MANIFEST", () => {
  it("exposes the module identity and REST base path", () => {
    expect(CONTACTS_MODULE_MANIFEST.moduleId).toBe("contacts");
    expect(CONTACTS_MODULE_MANIFEST.restBasePath).toBe("/api/contacts");
  });

  it("defines the three tiers in order", () => {
    expect(CONTACTS_MODULE_MANIFEST.tiers).toEqual(["work", "reports", "setup"]);
  });

  it("defines read/write/delete permissions", () => {
    expect(CONTACTS_MODULE_MANIFEST.permissions.read).toBe("contacts.read");
    expect(CONTACTS_MODULE_MANIFEST.permissions.write).toBe("contacts.write");
    expect(CONTACTS_MODULE_MANIFEST.permissions.delete).toBe("contacts.delete");
  });

  it("uses table/cards Work directory views", () => {
    expect(CONTACTS_MODULE_MANIFEST.work.directoryViews).toEqual(["table", "cards"]);
  });

  it("configures server pagination defaults", () => {
    expect(CONTACTS_MODULE_MANIFEST.defaultPageSize).toBe(50);
    expect(CONTACTS_MODULE_MANIFEST.maxPageSize).toBe(100);
  });

  it("captures soft-delete deletion reasons", () => {
    expect(CONTACTS_MODULE_MANIFEST.softDelete.captureDeletionReason).toBe(true);
    expect(CONTACTS_MODULE_MANIFEST.softDelete.workExcludesDeleted).toBe(true);
  });

  it("orders Setup sub-tabs as preferences/sync", () => {
    expect(CONTACTS_MODULE_MANIFEST.setupSubTabs).toEqual(["preferences", "sync"]);
  });
});

describe("contactRecordSchema", () => {
  it("parses a full contact", () => {
    const contact = {
      id: "c1",
      firstName: "Aisha",
      lastName: "Khan",
      phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92" }],
      emails: [{ label: "Primary", address: "aisha@example.com" }],
    };
    expect(contactRecordSchema.safeParse(contact).success).toBe(true);
  });

  it("is passthrough — accepts an extra custom key", () => {
    const result = contactRecordSchema.safeParse({
      id: "c1",
      firstName: "Aisha",
      customField: "x",
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.customField).toBe("x");
  });

  it("rejects a missing first name", () => {
    expect(contactRecordSchema.safeParse({ id: "c1" }).success).toBe(false);
    expect(contactRecordSchema.safeParse({ id: "c1", firstName: "" }).success).toBe(false);
  });
});

describe("contactListSchema", () => {
  it("parses an array of contact records", () => {
    const list = [
      { id: "c1", firstName: "Aisha" },
      { id: "c2", firstName: "Bilal" },
    ];
    expect(contactListSchema.safeParse(list).success).toBe(true);
  });
});
