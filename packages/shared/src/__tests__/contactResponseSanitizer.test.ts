import { describe, expect, it } from "vitest";
import {
  sanitizeContactForViewer,
  sanitizeContactsForViewer,
  summarizeContactFieldChanges,
  type ContactFieldConfigSnapshot,
} from "../contacts/contactResponseSanitizer.js";
import type { Contact } from "../contacts/contactTypes.js";

describe("contactResponseSanitizer", () => {
  const mockConfig: ContactFieldConfigSnapshot = {
    tabs: [
      { key: "basic", label: "Basic", enabled: true, order: 1 },
      { key: "phones", label: "Phones", enabled: true, order: 2 },
    ],
    fields: {
      basic: [
        {
          key: "firstName",
          type: "text",
          label: "First Name",
          required: true,
          enabled: true,
          order: 1,
        },
        {
          key: "lastName",
          type: "text",
          label: "Last Name",
          required: true,
          enabled: true,
          order: 2,
        },
      ],
      phones: [
        {
          key: "number",
          type: "text",
          label: "Phone Number",
          required: true,
          enabled: true,
          order: 1,
        },
      ],
    },
  };

  const sampleContact: Contact = {
    id: "c1",
    name: "Jane Doe",
    firstName: "Jane",
    lastName: "Doe",
    phones: [{ label: "Mobile", number: "+123456789" }],
  };

  describe("sanitizeContactForViewer", () => {
    it("preserves fields authorized for admin role", () => {
      const sanitized = sanitizeContactForViewer(sampleContact, "admin", mockConfig);
      expect(sanitized.firstName).toBe("Jane");
      expect(sanitized.lastName).toBe("Doe");
      expect(sanitized.phones).toEqual([{ label: "Mobile", number: "+123456789" }]);
    });

    it("batch sanitizes contacts array for a viewer role", () => {
      const list = sanitizeContactsForViewer([sampleContact], "admin", mockConfig);
      expect(list.length).toBe(1);
      expect(list[0].id).toBe("c1");
    });

    it("drops a list tab's rows when the tab is disabled or role-restricted", () => {
      const config: ContactFieldConfigSnapshot = {
        tabs: [
          { key: "basic", label: "Basic", enabled: true, order: 1 },
          { key: "education", label: "Education", enabled: false, order: 3 },
        ],
        fields: {
          basic: [{ key: "firstName", type: "text", label: "First", enabled: true, order: 1 }],
          education: [
            {
              key: "institution",
              type: "text",
              label: "Institution",
              enabled: true,
              order: 1,
              permissions: ["admin"],
            },
          ],
        },
      };
      const contact: Contact = {
        id: "c1",
        name: "Ali",
        firstName: "Ali",
        education: [{ id: "edu1", institution: "Secret University", sortOrder: 0 }],
      };
      const sanitized = sanitizeContactForViewer(contact, "teacher", config);
      expect(sanitized.firstName).toBe("Ali");
      expect(sanitized.education).toBeUndefined();
    });

    it("strips a permission-gated field inside a visible list tab", () => {
      const config: ContactFieldConfigSnapshot = {
        tabs: [
          { key: "basic", label: "Basic", enabled: true, order: 1 },
          { key: "education", label: "Education", enabled: true, order: 3 },
        ],
        fields: {
          basic: [{ key: "firstName", type: "text", label: "First", enabled: true, order: 1 }],
          education: [
            {
              key: "institution",
              type: "text",
              label: "Institution",
              enabled: true,
              order: 1,
              permissions: ["admin"],
            },
            { key: "degree", type: "text", label: "Degree", enabled: true, order: 2 },
          ],
        },
      };
      const contact: Contact = {
        id: "c1",
        name: "Ali",
        firstName: "Ali",
        education: [{ id: "edu1", institution: "Secret University", degree: "PhD", sortOrder: 0 }],
      };
      const sanitized = sanitizeContactForViewer(contact, "teacher", config);
      expect(sanitized.education).toEqual([{ id: "edu1", degree: "PhD", sortOrder: 0 }]);
    });

    it("drops the whole phones collection when the phone number field is hidden", () => {
      const config: ContactFieldConfigSnapshot = {
        tabs: [{ key: "phones", label: "Phones", enabled: true, order: 1 }],
        fields: {
          phones: [
            {
              key: "number",
              type: "text",
              label: "Phone",
              enabled: true,
              order: 1,
              permissions: ["admin"],
            },
          ],
        },
      };
      const sanitized = sanitizeContactForViewer(sampleContact, "teacher", config);
      expect(sanitized.phones).toBeUndefined();
      expect(sanitized.phone).toBeUndefined();
    });
  });

  describe("summarizeContactFieldChanges", () => {
    it("summarizes field changes between two contact states for audit logging", () => {
      const before: Contact = { ...sampleContact, firstName: "Jane" };
      const after: Contact = { ...sampleContact, firstName: "Janey" };
      const summary = summarizeContactFieldChanges(before, after);
      expect(summary).toBe("Changed: firstName");
    });

    it("returns default message when no fields are modified", () => {
      const summary = summarizeContactFieldChanges(sampleContact, sampleContact);
      expect(summary).toBe("Updated contact (no field diff)");
    });
  });
});
