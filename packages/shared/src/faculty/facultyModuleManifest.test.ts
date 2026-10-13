import { describe, expect, it } from "vitest";
import {
  facultyCoreSchema,
  facultyRecordSchema,
  FACULTY_STATUS_WRITE_MAX,
} from "./facultyModuleManifest.js";

describe("facultyCoreSchema status (lookup SSOT)", () => {
  it("accepts every lifecycle status and rejects unknown ones", () => {
    expect(facultyCoreSchema.parse({ contactId: "c1", status: "active" }).status).toBe("active");
    expect(facultyCoreSchema.parse({ contactId: "c1", status: "retired" }).status).toBe("retired");
    expect(facultyCoreSchema.parse({ contactId: "c1", status: "terminated" }).status).toBe(
      "terminated",
    );
    expect(() => facultyCoreSchema.parse({ contactId: "c1", status: "sabbatical" })).toThrow();
  });

  it("rejects empty or oversized status", () => {
    expect(() => facultyCoreSchema.parse({ contactId: "c1", status: "" })).toThrow();
    expect(() =>
      facultyCoreSchema.parse({
        contactId: "c1",
        status: "x".repeat(FACULTY_STATUS_WRITE_MAX + 1),
      }),
    ).toThrow();
  });

  it("allows omitting contactId on the wire (requireContactLink enforced dynamically)", () => {
    const parsed = facultyCoreSchema.parse({ status: "active", specialization: "Hifz" });
    expect(parsed.contactId).toBeUndefined();
  });

  it("rejects empty-string contactId", () => {
    expect(() => facultyCoreSchema.parse({ contactId: "", status: "active" })).toThrow();
  });

  it("allows custom keys via catchall and does not declare contact profile dual-write keys", () => {
    const parsed = facultyCoreSchema.parse({
      contactId: "c1",
      status: "active",
      customNote: "hello",
    });
    expect(parsed.customNote).toBe("hello");
    expect("name" in facultyCoreSchema.shape).toBe(false);
    expect("phone" in facultyCoreSchema.shape).toBe(false);
    expect("email" in facultyCoreSchema.shape).toBe(false);
    expect("gender" in facultyCoreSchema.shape).toBe(false);
  });
});

describe("facultyRecordSchema", () => {
  it("strips contact profile keys even when contactId is omitted", () => {
    const parsed = facultyRecordSchema.parse({
      specialization: "Hifz",
      status: "active",
      name: "Should Strip",
      phone: "+100",
    });
    expect((parsed as Record<string, unknown>).name).toBeUndefined();
    expect((parsed as Record<string, unknown>).phone).toBeUndefined();
    expect(parsed.specialization).toBe("Hifz");
  });
});
