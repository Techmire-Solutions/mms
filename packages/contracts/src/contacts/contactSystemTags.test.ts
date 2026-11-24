import { describe, expect, it } from "vitest";
import { contactWriteSchema } from "../schemas/contacts.dto.js";
import {
  CONTACT_SYSTEM_TAG_KEYS,
  filterManualContactTags,
  formatArchivedSystemTag,
  formatFacultySystemTag,
  isReservedSystemTagName,
  splitContactTags,
  systemTagBaseName,
} from "./contactSystemTags.js";

describe("contact system tags", () => {
  it("formats faculty and archived names", () => {
    expect(formatFacultySystemTag("  Head   of Department ")).toBe("faculty-Head of Department");
    expect(formatArchivedSystemTag("faculty-Teacher")).toBe("Former faculty-Teacher");
    expect(formatArchivedSystemTag("Former Student")).toBe("Former Student");
    expect(systemTagBaseName("Former faculty-Teacher")).toBe("faculty-Teacher");
  });

  it("reserves every faculty and student role name", () => {
    for (const name of [
      "faculty-Teacher",
      "Faculty-Principal",
      "Former faculty-Teacher",
      "Student",
      "parent",
      "GUARDIAN",
      "Former Student",
      "Former Parent",
      "Former Guardian",
    ]) {
      expect(isReservedSystemTagName(name), name).toBe(true);
    }
    expect(isReservedSystemTagName("Student Council")).toBe(false);
    expect(isReservedSystemTagName("VIP")).toBe(false);
  });

  it("filters reserved names and case-insensitive duplicates from manual tags", () => {
    expect(
      filterManualContactTags(["VIP", "vip", " Student ", "faculty-Teacher", "Donor", ""]),
    ).toEqual(["VIP", "Donor"]);
  });

  it("accepts the read-only systemTags projection on a write payload", () => {
    const parsed = contactWriteSchema.parse({
      firstName: "Ayesha",
      systemTags: [
        {
          name: "Student",
          source: "student",
          systemKey: "student:self",
          archived: false,
        },
      ],
    }) as { systemTags?: unknown[] };
    expect(parsed.systemTags).toHaveLength(1);
  });

  it("splits read models into editable and system tags", () => {
    const system = {
      name: "faculty-Teacher",
      source: "faculty" as const,
      systemKey: CONTACT_SYSTEM_TAG_KEYS.facultyDesignation("d1"),
      archived: false,
    };
    expect(
      splitContactTags({
        tags: ["VIP", "faculty-Teacher", "Student"],
        systemTags: [system],
      }),
    ).toEqual({
      manualTags: ["VIP"],
      systemTags: [system],
    });
  });
});
