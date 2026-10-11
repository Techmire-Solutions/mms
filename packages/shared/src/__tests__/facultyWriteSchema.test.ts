import { describe, expect, it } from "vitest";
import { stripFacultyClientSoftDeleteFields, stripFacultyWriteNoise } from "../facultyUtils.js";
import { isFacultyDeleted, filterActiveFaculty } from "../facultyTypes.js";
import { buildDynamicFacultySchema } from "../schemas/faculty.dto.js";
import { DEFAULT_FACULTY_SETTINGS } from "../facultyModuleSettings.js";

describe("facultyWriteSchema and soft-delete helpers", () => {
  it("stripFacultyClientSoftDeleteFields strips all soft-delete metadata and deleted flag", () => {
    const raw = {
      id: "t-1",
      employeeId: "EMP-01",
      deletedAt: "2026-01-01T00:00:00.000Z",
      deletedBy: "u-1",
      deletionReason: "Left",
      restoredAt: "2026-02-01T00:00:00.000Z",
      restoredBy: "u-2",
      deletedWithCascade: true,
      deleted: true,
    };

    const stripped = stripFacultyClientSoftDeleteFields(raw);
    expect(stripped.deletedAt).toBeUndefined();
    expect(stripped.deletedBy).toBeUndefined();
    expect(stripped.deletionReason).toBeUndefined();
    expect(stripped.restoredAt).toBeUndefined();
    expect(stripped.restoredBy).toBeUndefined();
    expect(stripped.deletedWithCascade).toBeUndefined();
    expect(stripped.deleted).toBeUndefined();
    expect(stripped.id).toBe("t-1");
    expect(stripped.employeeId).toBe("EMP-01");
  });

  it("stripFacultyWriteNoise removes contact profile keys, avatar, and soft delete keys", () => {
    const raw = {
      contactId: "c-1",
      name: "Faculty Member",
      phone: "+923001234567",
      email: "faculty@test.com",
      gender: "female",
      avatar: "https://example.com/avatar.png",
      deletedAt: "2026-01-01T00:00:00.000Z",
      employeeId: "EMP-02",
    };

    const cleaned = stripFacultyWriteNoise(raw);
    expect(cleaned.name).toBeUndefined();
    expect(cleaned.phone).toBeUndefined();
    expect(cleaned.email).toBeUndefined();
    expect(cleaned.gender).toBeUndefined();
    expect(cleaned.avatar).toBeUndefined();
    expect(cleaned.deletedAt).toBeUndefined();
    expect(cleaned.contactId).toBe("c-1");
    expect(cleaned.employeeId).toBe("EMP-02");
  });

  it("stripFacultyWriteNoise strips transient designation and hierarchy metadata", () => {
    const raw = {
      contactId: "c-1",
      employeeId: "EMP-02",
      designationAssignableRoles: ["faculty", "admin"],
      designationEndsOn: "2026-12-31",
      contact: { id: "c-1", name: "Ustadh" },
      subordinates: [{ id: "f-2" }],
    };

    const cleaned = stripFacultyWriteNoise(raw);
    expect(cleaned.designationAssignableRoles).toBeUndefined();
    expect(cleaned.designationEndsOn).toBe("2026-12-31");
    expect(cleaned.contact).toBeUndefined();
    expect(cleaned.subordinates).toBeUndefined();
    expect(cleaned.contactId).toBe("c-1");
    expect(cleaned.employeeId).toBe("EMP-02");
  });

  it("buildDynamicFacultySchema allows transient designation and hierarchy fields by stripping them", () => {
    const schema = buildDynamicFacultySchema(DEFAULT_FACULTY_SETTINGS, new Set(["basic"]), {
      basic: [
        {
          key: "contactId",
          label: "Contact",
          type: "text",
          enabled: true,
          required: true,
          order: 1,
        },
        {
          key: "employeeId",
          label: "Employee ID",
          type: "text",
          enabled: true,
          required: false,
          order: 2,
        },
      ],
    });

    const parsed = schema.safeParse({
      contactId: "c-1",
      employeeId: "EMP-03",
      designationId: "des-1",
      designationAssignableRoles: ["faculty"],
      departmentId: "dept-1",
      parentDesignationId: "des-0",
      departmentName: "Hifz",
      designationName: "Hafiz Teacher",
      performanceRating: 4.2,
      contact: { name: "Faculty Member" },
      subordinates: [],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const data = parsed.data as Record<string, unknown>;
      expect(data).not.toHaveProperty("designationAssignableRoles");
      expect(data).not.toHaveProperty("departmentId");
      expect(data).not.toHaveProperty("parentDesignationId");
      expect(data).not.toHaveProperty("departmentName");
      expect(data).not.toHaveProperty("designationName");
      expect(data).not.toHaveProperty("performanceRating");
      expect(data).not.toHaveProperty("contact");
      expect(data).not.toHaveProperty("subordinates");
    }
  });

  it("buildDynamicFacultySchema strips soft-delete metadata and strictly validates fields", () => {
    const schema = buildDynamicFacultySchema(DEFAULT_FACULTY_SETTINGS, new Set(["basic"]), {
      basic: [
        {
          key: "contactId",
          label: "Contact",
          type: "text",
          enabled: true,
          required: true,
          order: 1,
        },
        {
          key: "employeeId",
          label: "Employee ID",
          type: "text",
          enabled: true,
          required: false,
          order: 2,
        },
        { key: "status", label: "Status", type: "text", enabled: true, required: false, order: 3 },
      ],
    });

    const parsed = schema.safeParse({
      contactId: "c-1",
      employeeId: "EMP-03",
      designationId: "des-1",
      status: "active",
      deletedAt: "2026-01-01T00:00:00.000Z",
      deletedBy: "u-1",
      deletionReason: "Archived",
      deleted: true,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const data = parsed.data as Record<string, unknown>;
      expect(data).not.toHaveProperty("deletedAt");
      expect(data).not.toHaveProperty("deletedBy");
      expect(data).not.toHaveProperty("deletionReason");
      expect(data).not.toHaveProperty("deleted");
      expect(data.contactId).toBe("c-1");
      expect(data.employeeId).toBe("EMP-03");
    }
  });

  it("buildDynamicFacultySchema rejects unknown properties via strict schema", () => {
    const schema = buildDynamicFacultySchema(DEFAULT_FACULTY_SETTINGS, new Set(["basic"]), {
      basic: [
        {
          key: "contactId",
          label: "Contact",
          type: "text",
          enabled: true,
          required: true,
          order: 1,
        },
      ],
    });

    const parsed = schema.safeParse({
      contactId: "c-1",
      designationId: "des-1",
      maliciousField: "exploit",
    });

    expect(parsed.success).toBe(false);
  });

  it("isFacultyDeleted identifies soft-deleted faculty", () => {
    expect(isFacultyDeleted({ deletedAt: "2026-01-01T00:00:00.000Z" })).toBe(true);
    expect(isFacultyDeleted({ deletedAt: null })).toBe(false);
    expect(isFacultyDeleted({})).toBe(false);
  });

  it("filterActiveFaculty excludes archived faculty", () => {
    const list = [
      { id: "1", status: "active", contactId: "c1" },
      { id: "2", status: "active", contactId: "c2", deletedAt: "2026-01-01T00:00:00.000Z" },
      { id: "3", status: "on_leave", contactId: "c3", deletedAt: null },
    ];

    const active = filterActiveFaculty(list);
    expect(active.map((f: { id: string }) => f.id)).toEqual(["1", "3"]);
  });
});
