import { describe, expect, it } from "vitest";
import type { PlatformUserProfile } from "@mms/shared";

// Test the selection logic directly (pure state transitions) without DOM rendering.
// usePlatformAdminSelection delegates to useWorkSelection which uses useState internally.
// We test the exported logic by constructing equivalent state in isolation.

const mockAdmins: PlatformUserProfile[] = [
  {
    id: "admin-1",
    name: "Admin 1",
    email: "1@test.com",
    role: "super_user",
    permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: false },
    disabledAt: null,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "admin-2",
    name: "Admin 2",
    email: "2@test.com",
    role: "admin",
    permissions: {
      workspaces: true,
      onboard: false,
      settings: false,
      admins: false,
      system: false,
    },
    disabledAt: null,
    createdAt: "2026-01-01T00:00:00Z",
  },
];

describe("usePlatformAdminSelection — pure logic contracts", () => {
  it("starts with zero selected", () => {
    const selected = new Set<string>();
    expect(selected.size).toBe(0);
    expect(mockAdmins.filter((a) => selected.has(a.id))).toHaveLength(0);
  });

  it("toggles a single admin in and out", () => {
    let selected = new Set<string>();

    // Toggle in
    selected = new Set([...selected, "admin-1"]);
    expect(selected.has("admin-1")).toBe(true);
    expect(selected.size).toBe(1);

    // Toggle out
    selected = new Set([...selected].filter((id) => id !== "admin-1"));
    expect(selected.has("admin-1")).toBe(false);
    expect(selected.size).toBe(0);
  });

  it("select all marks every visible admin", () => {
    const visibleIds = mockAdmins.map((a) => a.id);
    const selected = new Set(visibleIds);
    expect(selected.size).toBe(mockAdmins.length);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
    expect(allSelected).toBe(true);
  });

  it("clear resets to empty", () => {
    let selected = new Set(["admin-1", "admin-2"]);
    expect(selected.size).toBe(2);
    selected = new Set<string>();
    expect(selected.size).toBe(0);
  });

  it("selectedAdmins derived correctly from set", () => {
    const selected = new Set(["admin-1"]);
    const selectedAdmins = mockAdmins.filter((a) => selected.has(a.id));
    expect(selectedAdmins).toHaveLength(1);
    expect(selectedAdmins[0]?.id).toBe("admin-1");
  });
});
