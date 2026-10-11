import { describe, expect, it } from "vitest";
import {
  sanitizeFacultyForViewer,
  sanitizeFacultyListForViewer,
  type FacultyFieldConfigSnapshot,
} from "../facultyResponseSanitizer.js";
import type { FacultyMember } from "../facultyTypes.js";

describe("facultyResponseSanitizer", () => {
  const mockConfig: FacultyFieldConfigSnapshot = {
    tabs: [
      { key: "basic", label: "Profile", enabled: true, order: 1 },
      { key: "employment", label: "Employment", enabled: true, order: 2 },
    ],
    fields: {
      basic: [
        {
          key: "qualification",
          type: "text",
          label: "Qualification",
          required: false,
          enabled: true,
          order: 1,
        },
      ],
      employment: [
        {
          key: "joinDate",
          type: "date",
          label: "Join Date",
          required: false,
          enabled: true,
          order: 1,
        },
      ],
    },
  };

  const sampleFaculty: FacultyMember = {
    id: "f1",
    contactId: "c1",
    name: "Ada Lovelace",
    employeeId: "FAC-1",
    status: "active",
    qualification: "Ijazah",
    joinDate: "2024-01-01",
    notes: "Private",
  };

  describe("sanitizeFacultyForViewer", () => {
    it("preserves always-visible identity keys regardless of role", () => {
      const sanitized = sanitizeFacultyForViewer(sampleFaculty, "viewer", mockConfig);
      expect(sanitized.id).toBe("f1");
      expect(sanitized.contactId).toBe("c1");
      expect(sanitized.name).toBe("Ada Lovelace");
      expect(sanitized.employeeId).toBe("FAC-1");
      expect(sanitized.status).toBe("active");
    });

    it("keeps fields authorized for the viewer role", () => {
      const sanitized = sanitizeFacultyForViewer(sampleFaculty, "admin", mockConfig);
      expect(sanitized.qualification).toBe("Ijazah");
      expect(sanitized.joinDate).toBe("2024-01-01");
    });

    it("drops fields restricted by tab permissions", () => {
      const restrictedConfig: FacultyFieldConfigSnapshot = {
        ...mockConfig,
        tabs: [
          { key: "basic", label: "Profile", enabled: true, order: 1 },
          {
            key: "employment",
            label: "Employment",
            enabled: true,
            order: 2,
            permissions: ["admin"],
          },
        ],
      };
      const sanitized = sanitizeFacultyForViewer(sampleFaculty, "viewer", restrictedConfig);
      expect(sanitized.joinDate).toBeUndefined();
      expect(sanitized.qualification).toBe("Ijazah");
    });

    it("drops fields restricted by field permissions", () => {
      const restrictedConfig: FacultyFieldConfigSnapshot = {
        ...mockConfig,
        fields: {
          ...mockConfig.fields,
          employment: [
            {
              key: "joinDate",
              type: "date",
              label: "Join Date",
              required: false,
              enabled: true,
              order: 1,
              permissions: ["admin"],
            },
          ],
        },
      };
      const sanitized = sanitizeFacultyForViewer(sampleFaculty, "viewer", restrictedConfig);
      expect(sanitized.joinDate).toBeUndefined();
      const admin = sanitizeFacultyForViewer(sampleFaculty, "admin", restrictedConfig);
      expect(admin.joinDate).toBe("2024-01-01");
    });

    it("returns the faculty member unchanged when the config has no tabbed field registry", () => {
      const sanitized = sanitizeFacultyForViewer(sampleFaculty, "admin", {
        fields: { qualification: { enabled: true } } as never,
        tabs: [],
      });
      expect(sanitized).toEqual(sampleFaculty);
    });
  });

  describe("sanitizeFacultyListForViewer", () => {
    it("batch sanitizes faculty members for a viewer role", () => {
      const list = sanitizeFacultyListForViewer([sampleFaculty], "viewer", mockConfig);
      expect(list.length).toBe(1);
      expect(list[0].id).toBe("f1");
      // Unregistered keys survive (compat); only registered Setup fields are gated.
      expect(list[0].notes).toBe("Private");
    });
  });
});
