import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createOptionalContextHooks } from "./optionalQueryContext";

function renderProbe(element: ReactElement): { unmount: () => void } {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe("createOptionalContextHooks", () => {
  it("returns the provider's QueryClient without reporting", () => {
    const report = vi.fn();
    const hooks = createOptionalContextHooks({ report });
    const provided = new QueryClient();
    const observed: QueryClient[] = [];

    function Probe() {
      observed.push(hooks.useQueryClientOrFallback());
      return null;
    }

    const { unmount } = renderProbe(
      <QueryClientProvider client={provided}>
        <Probe />
      </QueryClientProvider>,
    );
    unmount();

    expect(observed[0]).toBe(provided);
    expect(report).not.toHaveBeenCalled();
  });

  it("falls back to a detached client and reports a missing provider once", () => {
    const report = vi.fn();
    const hooks = createOptionalContextHooks({ report });
    const observed: QueryClient[] = [];

    function Probe() {
      observed.push(hooks.useQueryClientOrFallback());
      return null;
    }

    const { unmount } = renderProbe(<Probe />);
    unmount();

    expect(observed.length).toBeGreaterThan(0);
    expect(observed.every((client) => client instanceof QueryClient)).toBe(true);
    // Same fallback instance is reused, so it is not a new client per render.
    expect(observed[0]).toBe(observed.at(-1));
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0][1]).toMatchObject({ scope: "query-client" });
  });

  it("reports a missing AuthProvider once and returns null", () => {
    const report = vi.fn();
    const hooks = createOptionalContextHooks({ report });
    const observed: unknown[] = [];

    function Probe() {
      observed.push(hooks.useAuthOrNull());
      return null;
    }

    const { unmount } = renderProbe(<Probe />);
    unmount();

    expect(observed.every((value) => value === null)).toBe(true);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0][1]).toMatchObject({ scope: "auth" });
  });

  it("stays silent when the test build opts out", () => {
    const report = vi.fn();
    const hooks = createOptionalContextHooks({ report, silent: true });

    function Probe() {
      hooks.useQueryClientOrFallback();
      hooks.useAuthOrNull();
      return null;
    }

    const { unmount } = renderProbe(<Probe />);
    unmount();

    expect(report).not.toHaveBeenCalled();
  });

  it("keeps report scopes independent (client and auth said once each)", () => {
    const report = vi.fn();
    const hooks = createOptionalContextHooks({ report });

    function Probe() {
      hooks.useQueryClientOrFallback();
      hooks.useAuthOrNull();
      return null;
    }

    const { unmount } = renderProbe(<Probe />);
    unmount();

    expect(report).toHaveBeenCalledTimes(2);
    expect(report.mock.calls.map((call) => call[1]?.scope)).toEqual(["query-client", "auth"]);
  });
});
