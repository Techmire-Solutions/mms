import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLATFORM_ADMIN_PERMISSIONS, type PlatformUserProfile } from "@mms/shared";
import {
  usePlatformPermissionMatrix,
  type PendingPermissionToggle,
} from "./usePlatformPermissionMatrix";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), isSuperUser: true, busy: false }));
const admin: PlatformUserProfile = {
  id: "other",
  name: "Operator",
  email: "operator@example.com",
  role: "admin",
  permissions: { ...DEFAULT_PLATFORM_ADMIN_PERMISSIONS, settings: true },
};
vi.mock("./usePlatformAdmins", () => ({
  usePlatformAdmins: () => ({ data: [admin], isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdatePlatformAdminPermissions: () => ({ mutate: mocks.mutate, isPending: mocks.busy }),
}));
vi.mock("./usePlatformPermissions", () => ({
  usePlatformPermissions: () => ({ isSuperUser: mocks.isSuperUser, platformUser: { id: "self" } }),
}));

function Probe({
  target = admin,
  onReady,
}: {
  target?: PlatformUserProfile;
  onReady?: (pending: PendingPermissionToggle | null) => void;
}) {
  const { handleToggle, pendingToggle } = usePlatformPermissionMatrix();
  onReady?.(pendingToggle);
  return <button onClick={() => handleToggle(target, "workspaces")}>Toggle</button>;
}

async function toggle(target?: PlatformUserProfile) {
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Probe target={target} />));
    await act(async () => container.querySelector("button")?.click());
  } finally {
    await act(async () => root.unmount());
  }
}

beforeEach(() => {
  mocks.mutate.mockClear();
  mocks.isSuperUser = true;
  mocks.busy = false;
});

describe("permission matrix updates", () => {
  it("queues a password step-up for the selected capability", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    let pending: PendingPermissionToggle | null = null;
    try {
      await act(async () =>
        root.render(
          <Probe
            onReady={(value) => {
              pending = value;
            }}
          />,
        ),
      );
      await act(async () => container.querySelector("button")?.click());
      expect(pending).toEqual({
        admin,
        permissions: { ...admin.permissions, workspaces: true },
      });
      expect(mocks.mutate).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("blocks self edits, super-user edits, limited operators, and concurrent mutations", async () => {
    await toggle({ ...admin, id: "self" });
    await toggle({ ...admin, role: "super_user" });
    mocks.isSuperUser = false;
    await toggle();
    mocks.isSuperUser = true;
    mocks.busy = true;
    await toggle();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
