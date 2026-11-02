import { describe, expect, it } from "vitest";
import type { User } from "@mms/shared";
import { canUseContactPicker } from "../lib/rbacCanModuleHelpers.js";

const asUser = (role?: string): User => ({ id: "u1", role }) as unknown as User;

describe("canUseContactPicker", () => {
  it("grants a teacher through the students read permission", () => {
    expect(canUseContactPicker(asUser("teacher"))).toBe(true);
  });

  it("grants an assistant teacher through the students read permission", () => {
    expect(canUseContactPicker(asUser("assistant_teacher"))).toBe(true);
  });

  it("grants a librarian through the students read permission", () => {
    expect(canUseContactPicker(asUser("librarian"))).toBe(true);
  });

  it("grants an accountant through the contacts read permission", () => {
    expect(canUseContactPicker(asUser("accountant"))).toBe(true);
  });

  it("grants admin through the contacts read permission", () => {
    expect(canUseContactPicker(asUser("admin"))).toBe(true);
  });

  it("denies a role with none of the grants", () => {
    expect(canUseContactPicker(asUser("viewer"))).toBe(false);
  });

  it("denies a missing role", () => {
    expect(canUseContactPicker(asUser(undefined))).toBe(false);
  });
});
