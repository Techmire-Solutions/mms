import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useEnrollmentsWidgetAggregates,
  type EnrollmentsWidgetAggregateWidgetInput,
} from "./useEnrollmentsQueries";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const widgetAggregates = vi.hoisted(() => vi.fn());
const mockAuthState = vi.hoisted(() => ({ isAuthenticated: true }));

vi.mock("@mms/fe-core/api/tsRest", () => ({
  apiContract: { enrollments: { widgetAggregates: widgetAggregates } },
  tsrClient: {},
}));

vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

let hookResult: ReturnType<typeof useEnrollmentsWidgetAggregates> | null = null;

function Harness({ widgets }: { widgets: EnrollmentsWidgetAggregateWidgetInput[] }) {
  hookResult = useEnrollmentsWidgetAggregates(widgets);
  return null;
}

describe("useEnrollmentsWidgetAggregates", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    widgetAggregates.mockReset();
    widgetAggregates.mockResolvedValue({
      status: 200,
      body: { results: {} },
      headers: new Headers(),
    });
    mockAuthState.isAuthenticated = true;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
  });

  it("passes the query abort signal through to the API transport", async () => {
    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(Harness, {
            widgets: [{ id: "w1", collection: "enrollments", operation: "count" }],
          }),
        ),
      );
    });

    await act(async () => {
      await vi.waitFor(() => expect(widgetAggregates).toHaveBeenCalledTimes(1));
    });

    const args = widgetAggregates.mock.calls[0]?.[0] as {
      body?: { widgets: unknown[] };
      fetchOptions?: { signal?: AbortSignal };
    };
    expect(args?.body?.widgets).toHaveLength(1);
    expect(args?.fetchOptions?.signal).toBeInstanceOf(AbortSignal);
    expect(hookResult?.data).toEqual({});
  });
});
