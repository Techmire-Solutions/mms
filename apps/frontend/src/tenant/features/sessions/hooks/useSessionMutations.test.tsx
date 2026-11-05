import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiError";
import type { Session } from "@/lib/data/sessionsData";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const h = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  restore: vi.fn(),
  bulkDelete: vi.fn(),
  bulkRestore: vi.fn(),
  bulkStatus: vi.fn(),
}));

vi.mock("@/lib/api", () => {
  const hook = (mutateAsync: unknown) => ({
    useMutation: () => ({ isPending: false, mutateAsync }),
  });
  return {
    tsrClient: {
      sessions: {
        create: hook(h.create),
        update: hook(h.update),
        delete: hook(h.remove),
        restore: hook(h.restore),
        bulkDelete: hook(h.bulkDelete),
        bulkRestore: hook(h.bulkRestore),
        bulkStatus: hook(h.bulkStatus),
      },
    },
  };
});

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) };
});

import { useSessionMutations } from "./useSessionMutations";

const session = {
  id: "sess-1",
  name: "Hifz 2026",
  type: "Hifz",
  status: "draft",
  startDate: "2026-01-01",
  endDate: "2026-06-30",
  baseFee: 100,
  currency: "PKR",
  classes: [],
  faculty: [],
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as Session;

type Api = ReturnType<typeof useSessionMutations>;
let api: Api;

function Harness() {
  api = useSessionMutations();
  return null;
}

describe("useSessionMutations contract handling", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<Harness />);
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("rejects a 409 instead of treating it as a successful update", async () => {
    h.update.mockResolvedValueOnce({
      status: 409,
      body: { type: "session_locked", message: "This session has started" },
    });

    await act(async () => {
      await expect(api.updateSession.mutateAsync({ id: "sess-1", session })).rejects.toBeInstanceOf(
        ApiError,
      );
    });

    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { id: "sess-1" },
        headers: { "x-expected-updated-at": "2026-01-01T00:00:00.000Z" },
      }),
    );
  });

  it("returns the unwrapped session body on success", async () => {
    h.create.mockResolvedValueOnce({ status: 201, body: { session } });

    let created: Session | undefined;
    await act(async () => {
      created = await api.createSession.mutateAsync(session);
    });

    expect(created).toBe(session);
  });

  it("rejects a failed archive instead of showing the undo toast path", async () => {
    h.remove.mockResolvedValueOnce({
      status: 403,
      body: { type: "forbidden", message: "Insufficient permissions" },
    });

    await act(async () => {
      await expect(
        api.deleteSession.mutateAsync({ id: "sess-1", deletionReason: "cleanup" }),
      ).rejects.toBeInstanceOf(ApiError);
    });
  });
});
