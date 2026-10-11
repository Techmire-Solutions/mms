import { describe, expect, it } from "vitest";
import { roleHasPermission } from "@mms/shared";

describe("usePermissions matrix", () => {
  it("admin can write students", () => {
    expect(roleHasPermission("admin", "students.write")).toBe(true);
  });

  it("assistant_teacher cannot write users", () => {
    expect(roleHasPermission("assistant_teacher", "users.manage")).toBe(false);
  });

  it("teacher cannot access the contacts directory", () => {
    expect(roleHasPermission("teacher", "contacts.read")).toBe(false);
    expect(roleHasPermission("teacher", "contacts.write")).toBe(false);
    expect(roleHasPermission("teacher", "contacts.delete")).toBe(false);
  });

  it("accountant can read contacts but not write", () => {
    expect(roleHasPermission("accountant", "contacts.read")).toBe(true);
    expect(roleHasPermission("accountant", "contacts.write")).toBe(false);
  });
});
