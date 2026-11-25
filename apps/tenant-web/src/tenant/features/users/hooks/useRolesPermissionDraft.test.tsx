import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { WorkspaceRole } from "@mms/contracts";
import { useRolesPermissionDraft } from "./useRolesPermissionDraft";

/**
 * Regression: the draft was re-seeded only when the displayed role *id* changed.
 * Saving the same role updates its permissions without changing the id, so the
 * matrix kept the pre-save grants and a second save could write stale permissions
 * (silently reverting what had just been granted). The seed key must include the
 * persisted permission map.
 */

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type DraftHarness = {
  draft: Record<string, string[]> | null;
  dirty: boolean;
  toggle: (moduleId: string, action: string) => void;
};

let latest: DraftHarness | null = null;

function Harness({ role }: { role: WorkspaceRole | null }) {
  const hook = useRolesPermissionDraft(role);
  latest = {
    draft: hook.permDraft,
    dirty: hook.permDirty,
    toggle: (moduleId, action) => hook.togglePermDraft(moduleId, action as never),
  };
  return null;
}

const roleWith = (permissions: Record<string, string[]>): WorkspaceRole =>
  ({
    id: "role-teacher",
    name: "Teacher",
    description: "",
    permissions,
    isSystem: false,
  }) as unknown as WorkspaceRole;

describe("useRolesPermissionDraft re-seed", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    latest = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("re-seeds when the same role id is saved with different permissions", async () => {
    const before = roleWith({ students: ["read"] });
    await act(async () => {
      root.render(<Harness role={before} />);
    });
    expect(latest?.draft).toEqual({ students: ["read"] });
    expect(latest?.dirty).toBe(false);

    // The role form saved a new grant; the sidebar hands over a new object with the same id.
    const after = roleWith({ students: ["create", "read"] });
    await act(async () => {
      root.render(<Harness role={after} />);
    });
    expect(latest?.draft).toEqual({ students: ["create", "read"] });
    expect(latest?.dirty).toBe(false);
  });

  it("keeps an unsaved edit across a same-content re-render", async () => {
    await act(async () => {
      root.render(<Harness role={roleWith({ students: ["read"] })} />);
    });
    await act(async () => {
      latest?.toggle("students", "create");
    });
    expect(latest?.draft).toEqual({ students: ["read", "create"] });
    expect(latest?.dirty).toBe(true);

    // A refetch that produces an equal-value role object must not wipe the edit.
    await act(async () => {
      root.render(<Harness role={roleWith({ students: ["read"] })} />);
    });
    expect(latest?.draft).toEqual({ students: ["read", "create"] });
    expect(latest?.dirty).toBe(true);
  });
});
