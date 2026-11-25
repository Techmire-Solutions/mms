import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useHasanatContractBulkDelete,
  useHasanatContractBulkRestore,
  useHasanatContractDeleteDistribution,
  useHasanatContractRestoreDistribution,
} from "./useHasanatQueries.js";
import {
  HASANAT_DENOMS_QUERY_KEY,
  HASANAT_DISTRIBUTIONS_QUERY_KEY,
  HASANAT_REDEMPTIONS_QUERY_KEY,
} from "./hasanatQueryKeys.js";
import { HASANAT_PREFERENCES_QUERY_KEY } from "./useHasanatSetupConfig.js";
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@mms/fe-core/query/dashboardQueryKeys";

/** Captured mutation `onSuccess` callbacks keyed by contract method. */
const capturedOnSuccess = new Map<string, (data: unknown, vars: unknown) => void>();

vi.mock("@mms/fe-core/api/tsRest", () => {
  const makeMutation = (name: string) =>
    vi.fn((options: { onSuccess?: (data: unknown, vars: unknown) => void }) => {
      if (options.onSuccess) capturedOnSuccess.set(name, options.onSuccess);
      return { mutate: vi.fn(), mutateAsync: vi.fn(), reset: vi.fn() };
    });
  return {
    tsrClient: {
      hasanat: {
        bulkDeleteDistributions: { useMutation: makeMutation("bulkDelete") },
        bulkRestoreDistributions: { useMutation: makeMutation("bulkRestore") },
        deleteDistribution: { useMutation: makeMutation("delete") },
        restoreDistribution: { useMutation: makeMutation("restore") },
      },
    },
  };
});

vi.mock("./usePermissions.js", () => ({
  usePermissions: () => ({ can: () => true }),
}));

function renderContractMutations() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function Probe() {
    useHasanatContractBulkDelete();
    useHasanatContractBulkRestore();
    useHasanatContractDeleteDistribution();
    useHasanatContractRestoreDistribution();
    return null;
  }

  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });

  return {
    invalidateSpy,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const requestedKeys = (spy: { mock: { calls: ReadonlyArray<ReadonlyArray<unknown>> } }) =>
  spy.mock.calls.map((call) => (call[0] as { queryKey: readonly unknown[] }).queryKey);

const includes = (keys: readonly (readonly unknown[])[], target: readonly unknown[]) =>
  keys.some((key) => target.every((part, index) => key[index] === part));

describe("useHasanatContract* card mutations invalidation policy", () => {
  beforeEach(() => {
    capturedOnSuccess.clear();
  });

  it.each(["bulkDelete", "bulkRestore", "delete", "restore"] as const)(
    "%s invalidates work caches (lists + metrics + dashboard) and never setup preferences",
    (mutationName) => {
      const harness = renderContractMutations();
      try {
        const onSuccess = capturedOnSuccess.get(mutationName);
        expect(typeof onSuccess).toBe("function");

        act(() => {
          onSuccess?.({}, {});
        });

        const keys = requestedKeys(harness.invalidateSpy);
        expect(includes(keys, HASANAT_DISTRIBUTIONS_QUERY_KEY)).toBe(true);
        expect(includes(keys, HASANAT_REDEMPTIONS_QUERY_KEY)).toBe(true);
        expect(includes(keys, HASANAT_DENOMS_QUERY_KEY)).toBe(true);
        expect(includes(keys, DASHBOARD_SUMMARY_QUERY_KEY_ROOT)).toBe(true);
        // Card lifecycle writes cannot change the tenant's setup preferences;
        // refetching them here refetched the setup screen on every delete.
        expect(includes(keys, HASANAT_PREFERENCES_QUERY_KEY)).toBe(false);
      } finally {
        harness.cleanup();
      }
    },
  );
});
