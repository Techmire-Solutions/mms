import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  useEnrollmentsContractList,
  useEnrollmentsContractGet,
  useEnrollmentsContractCreate,
} from "./useEnrollmentsQueries";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock("@/lib/api", () => ({
  tsrClient: {
    enrollments: {
      list: {
        useQuery: vi.fn(() => ({ data: { body: [] }, isSuccess: true })),
      },
      get: {
        useQuery: vi.fn(() => ({ data: { body: null }, isSuccess: true })),
      },
      create: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      update: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      delete: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      bulkDelete: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      bulkRestore: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
    },
  },
}));

let listResult!: ReturnType<typeof useEnrollmentsContractList>;
let getResult!: ReturnType<typeof useEnrollmentsContractGet>;
let createResult!: ReturnType<typeof useEnrollmentsContractCreate>;

function TestComponent(): React.JSX.Element {
  listResult = useEnrollmentsContractList({ page: 1 });
  getResult = useEnrollmentsContractGet("enr-1");
  createResult = useEnrollmentsContractCreate();
  return React.createElement("div");
}

describe("useEnrollmentsQueries", () => {
  it("executes tsr query and mutation hooks properly", async () => {
    const root = createRoot(document.createElement("div"));
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(listResult?.isSuccess).toBe(true);
    expect(getResult?.isSuccess).toBe(true);
    expect(createResult?.isPending).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });
});
