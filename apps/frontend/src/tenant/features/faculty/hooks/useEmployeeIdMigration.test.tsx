import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEmployeeIdMigration } from "./useEmployeeIdMigration";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const migrateEmployeeIds = vi.fn();
const invalidateQueries = vi.fn();

vi.mock("@/lib/api", () => ({
  apiContract: {
    faculty: {
      migrateEmployeeIds: (...args: unknown[]) => migrateEmployeeIds(...args),
    },
  },
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockGetStoragePrefix = vi.fn(() => "mms_demo_");
vi.mock("@/lib/dbStorageCore", () => ({
  scopedStorageKey: (key: string) => `${mockGetStoragePrefix()}${key}`,
}));

vi.mock("@/tenant/features/faculty/hooks/invalidateFacultyQueries", () => ({
  invalidateFacultyQueries: () => invalidateQueries(),
}));

function Host(): React.JSX.Element {
  useEmployeeIdMigration("faculties", true);
  return <div />;
}

function makeClient(): QueryClient {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } });
}

let client: QueryClient;

async function mount(): Promise<{ root: Root; container: HTMLElement }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  client = makeClient();
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Host />
      </QueryClientProvider>,
    );
  });
  return { root, container };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useEmployeeIdMigration", () => {
  beforeEach(() => {
    localStorage.clear();
    migrateEmployeeIds.mockReset();
    invalidateQueries.mockReset();
    mockGetStoragePrefix.mockReturnValue("mms_demo_");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("scopes the one-shot gate to the workspace, not the browser", async () => {
    // A different workspace must not inherit the first workspace's "done" flag.
    localStorage.setItem("mms_other_faculty_employee_id_migration_v1", "1");
    migrateEmployeeIds.mockResolvedValue({ status: 200, body: { updated: 0 } });

    const { root, container } = await mount();
    await flush();

    expect(migrateEmployeeIds).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("mms_demo_faculty_employee_id_migration_v1")).toBe("1");
    expect(localStorage.getItem("mms_other_faculty_employee_id_migration_v1")).toBe("1");
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("skips the backfill when this workspace already ran it", async () => {
    localStorage.setItem("mms_demo_faculty_employee_id_migration_v1", "1");

    const { root, container } = await mount();
    await flush();

    expect(migrateEmployeeIds).not.toHaveBeenCalled();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("does not mark the gate done when the server rejects the backfill", async () => {
    migrateEmployeeIds.mockResolvedValue({
      status: 403,
      body: { message: "Forbidden" },
    });

    const { root, container } = await mount();
    await flush();

    expect(migrateEmployeeIds).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("mms_demo_faculty_employee_id_migration_v1")).toBeNull();
    expect(invalidateQueries).not.toHaveBeenCalled();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
