import { describe, expect, it } from "vitest";
import { facultyWriteSchema } from "../schemas/faculty.dto.js";
import {
  FACULTY_SERVER_OWNED_AUDIT_KEYS,
  stripFacultyServerOwnedAuditFields,
} from "./facultySoftDelete.js";

const BASE_WRITE = {
  contactId: "contact-1",
  designationId: "designation-1",
  contactName: "Ali Hasan",
};

describe("faculty server-owned audit fields", () => {
  it("covers the same attribution/timestamps Contacts and Students strip", () => {
    expect([...FACULTY_SERVER_OWNED_AUDIT_KEYS].sort()).toEqual(
      ["createdAt", "createdBy", "updatedAt", "updatedBy"].sort(),
    );
  });

  it("removes client attribution without mutating the input", () => {
    const input = {
      contactId: "contact-1",
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-02T00:00:00.000Z",
      createdBy: "victim",
      updatedBy: "victim",
    };

    const stripped = stripFacultyServerOwnedAuditFields(input);

    expect(stripped).toEqual({ contactId: "contact-1" });
    expect(input.createdBy).toBe("victim");
  });
});

describe("facultyWriteSchema attribution", () => {
  it("drops client-supplied created/updated attribution before persistence", () => {
    const parsed = facultyWriteSchema.parse({
      ...BASE_WRITE,
      userId: "victim-user",
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-02T00:00:00.000Z",
      createdBy: "victim-user",
      updatedBy: "victim-user",
    }) as Record<string, unknown>;

    expect(parsed.contactId).toBe("contact-1");
    expect(parsed.designationId).toBe("designation-1");
    expect(parsed.userId).toBeUndefined();
    expect(parsed.createdAt).toBeUndefined();
    expect(parsed.updatedAt).toBeUndefined();
    expect(parsed.createdBy).toBeUndefined();
    expect(parsed.updatedBy).toBeUndefined();
  });
});
