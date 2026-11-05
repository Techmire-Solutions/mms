import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/test/queryClientTestUtils";
import { scopedStorageKey } from "@/lib/dbStorageCore";
import { useGrMigration } from "@/tenant/features/students/hooks/useGrMigration";

const mocks = vi.hoisted(() => ({
  migrate: vi.fn(),
  invalidate: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiContract: {
    students: {
      migrateGrNumbers: (...args: unknown[]) => mocks.migrate(...args),
    },
  },
}));

vi.mock("@/tenant/features/students/hooks/invalidateStudentsQueries", () => ({
  invalidateStudentsQueries: (...args: unknown[]) => mocks.invalidate(...args),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: (...args: unknown[]) => mocks.notifySuccess(...args),
    error: (...args: unknown[]) => mocks.notifyError(...args),
  },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const MIGRATION_KEY = scopedStorageKey("students_gr_migration_v1");

describe("useGrMigration", () => {
  let container: HTMLDivElement;
  let root: Root;

  function renderHook(activeTab: string, canEditSetup: boolean): void {
    const client = createTestQueryClient();
    function TestComponent() {
      useGrMigration(activeTab, canEditSetup);
      return null;
    }
    act(() => {
      root.render(withQueryClient(<TestComponent />, client));
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.clear();
    vi.clearAllMocks();
    mocks.migrate.mockResolvedValue({ status: 200, body: { success: true, updated: 3 } });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
  });

  it("does not run until the Work tab is open for a Setup writer", async () => {
    renderHook("reports", true);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.migrate).not.toHaveBeenCalled();

    act(() => root.unmount());
    root = createRoot(container);
    renderHook("work", false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.migrate).not.toHaveBeenCalled();
  });

  it("backfills once, invalidates students and records the workspace-scoped gate", async () => {
    renderHook("work", true);

    await vi.waitFor(() => expect(mocks.migrate).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(mocks.notifySuccess).toHaveBeenCalled());

    expect(mocks.migrate).toHaveBeenCalledWith({ body: {} });
    expect(mocks.invalidate).toHaveBeenCalledTimes(1);
    // F-07: the one-shot flag is tenant-scoped, not the bare global key.
    expect(localStorage.getItem(MIGRATION_KEY)).toBe("1");
    expect(localStorage.getItem("students_gr_migration_v1")).toBeNull();
  });

  it("stays quiet when nothing needed backfilling", async () => {
    mocks.migrate.mockResolvedValue({ status: 200, body: { success: true, updated: 0 } });
    renderHook("work", true);

    await vi.waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
    expect(mocks.notifySuccess).not.toHaveBeenCalled();
    expect(localStorage.getItem(MIGRATION_KEY)).toBe("1");
  });

  it("reports a failure and leaves the gate open for a retry", async () => {
    mocks.migrate.mockResolvedValue({ status: 500, body: { message: "boom" } });
    renderHook("work", true);

    await vi.waitFor(() => expect(mocks.notifyError).toHaveBeenCalled());
    expect(localStorage.getItem(MIGRATION_KEY)).toBeNull();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it("keeps backfilling chunk by chunk until the server reports no more work", async () => {
    // 2026-11-04 review (M5): the route caps one call at 100 rows and returns
    // `hasMore`; ignoring it backfilled exactly one chunk and gated forever.
    mocks.migrate
      .mockResolvedValueOnce({ status: 200, body: { success: true, updated: 100, hasMore: true } })
      .mockResolvedValueOnce({ status: 200, body: { success: true, updated: 3, hasMore: false } });

    renderHook("work", true);

    await vi.waitFor(() => expect(mocks.migrate).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(localStorage.getItem(MIGRATION_KEY)).toBe("1"));
    expect(mocks.invalidate).toHaveBeenCalledTimes(1);
  });

  it("leaves the gate open when the chunk cap is reached with work remaining", async () => {
    mocks.migrate.mockResolvedValue({
      status: 200,
      body: { success: true, updated: 100, hasMore: true },
    });

    renderHook("work", true);

    await vi.waitFor(() => expect(mocks.migrate).toHaveBeenCalledTimes(20), {
      timeout: 5_000,
    });
    expect(localStorage.getItem(MIGRATION_KEY)).toBeNull();
  });

  it("does not re-run after a completed backfill on the next mount", async () => {
    renderHook("work", true);
    await vi.waitFor(() => expect(localStorage.getItem(MIGRATION_KEY)).toBe("1"));

    act(() => root.unmount());
    root = createRoot(container);
    renderHook("work", true);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.migrate).toHaveBeenCalledTimes(1);
  });
});
