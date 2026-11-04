import { beforeEach, describe, expect, it } from "vitest";
import type { User, WorkspaceRole } from "@mms/shared";
import { canReadCollection, canWriteCollection } from "../lib/rbacCanCollectionHelpers.js";
import { setUserRoleCatalog } from "../lib/userPermissionContext.js";

const composite: WorkspaceRole = {
  id: "faculty_ed_c1",
  labelKey: "nav.tasks",
  descriptionKey: "nav.tasks",
  isSystem: false,
  badgeVariant: "primary",
  permissions: { students: ["read"] },
};

function user(): User {
  return {
    id: "u-1",
    email: "composite@test.com",
    name: "Composite",
    role: "faculty_ed_c1",
    workspaceSubdomain: "demo",
  };
}

describe("collection helpers with a custom role", () => {
  beforeEach(() => {
    // no global state to reset: the catalog lives on the user object
  });

  it("denies until the request catalog is attached", () => {
    expect(canReadCollection(user(), "students")).toBe(false);
  });

  it("uses the attached catalog for read and write decisions", () => {
    const current = user();
    setUserRoleCatalog(current, [composite]);

    expect(canReadCollection(current, "students")).toBe(true);
    expect(canWriteCollection(current, "students")).toBe(false);
  });

  it("reflects a role edit immediately (no process-local decision cache)", () => {
    const current = user();
    setUserRoleCatalog(current, [{ ...composite, permissions: { students: ["read", "update"] } }]);

    expect(canWriteCollection(current, "students")).toBe(true);
    setUserRoleCatalog(current, [{ ...composite, permissions: {} }]);
    expect(canReadCollection(current, "students")).toBe(false);
  });
});
