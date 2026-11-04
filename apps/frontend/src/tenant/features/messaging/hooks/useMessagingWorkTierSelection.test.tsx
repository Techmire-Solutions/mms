import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { Message } from "@mms/shared";
import { useMessagingWorkTierSelection } from "./useMessagingWorkTierSelection";
import { useMessagingWorkFilters } from "./useMessagingWorkFilters";

const LOGS: Message[] = [
  {
    id: "log-1",
    userId: "u1",
    contactId: "c1",
    channel: "sms",
    body: "One",
    sentAt: "2026-01-01T00:00:00.000Z",
    status: "sent",
    category: "general",
  },
  {
    id: "log-2",
    userId: "u1",
    contactId: "c2",
    channel: "sms",
    body: "Two",
    sentAt: "2026-01-02T00:00:00.000Z",
    status: "sent",
    category: "general",
  },
  {
    id: "log-3",
    userId: "u1",
    contactId: "c3",
    channel: "sms",
    body: "Three",
    sentAt: "2026-01-03T00:00:00.000Z",
    status: "failed",
    category: "general",
  },
];

function renderHost(build: () => React.JSX.Element): {
  root: ReturnType<typeof createRoot>;
  container: HTMLDivElement;
} {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(build());
  });
  return { root, container };
}

describe("useMessagingWorkTierSelection", () => {
  it("clears the selection when the view scope changes", () => {
    const seen: Array<{ count: number; select: (index: number) => void }> = [];

    function Host({ scopeKey }: { scopeKey: string }) {
      const selection = useMessagingWorkTierSelection({ logs: LOGS, scopeKey });
      seen.push({
        count: selection.selectedCount,
        select: (index: number) => {
          const log = LOGS[index];
          if (log) selection.toggleLog(log);
        },
      });
      return null;
    }

    const { root } = renderHost(() => <Host scopeKey="active|page1" />);
    act(() => seen.at(-1)?.select(0));
    expect(seen.at(-1)?.count).toBe(1);

    act(() => {
      root.render(<Host scopeKey="active|page2" />);
    });
    expect(seen.at(-1)?.count).toBe(0);
  });

  it("keeps the selection while the scope is unchanged", () => {
    const counts: number[] = [];

    function Host() {
      const selection = useMessagingWorkTierSelection({ logs: LOGS, scopeKey: "stable" });
      counts.push(selection.selectedCount);
      return (
        <button type="button" onClick={() => selection.toggleAllVisible(true)}>
          select all
        </button>
      );
    }

    const { root, container } = renderHost(() => <Host />);
    const button = container.querySelector("button");
    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    act(() => {
      root.render(<Host />);
    });
    expect(counts.at(-1)).toBe(3);
  });
});

describe("useMessagingWorkFilters", () => {
  it("resets the page when a filter changes and gates the archived view", () => {
    const api: Array<{
      setStatus: (value: "all" | "sent" | "delivered" | "failed" | "skipped") => void;
      setShowArchived: (value: boolean) => void;
      page: number;
      showArchived: boolean;
    }> = [];

    function Host() {
      const filters = useMessagingWorkFilters({
        searchParams: new URLSearchParams(),
        setSearchParams: vi.fn() as never,
        canViewArchived: true,
      });
      api.push({
        setStatus: filters.setStatus,
        setShowArchived: filters.setShowArchived,
        page: filters.logsPage,
        showArchived: filters.showArchived,
      });
      return null;
    }

    const { root } = renderHost(() => <Host />);
    act(() => api.at(-1)?.setStatus("failed"));
    expect(api.at(-1)?.page).toBe(1);
    act(() => api.at(-1)?.setShowArchived(true));
    expect(api.at(-1)?.showArchived).toBe(true);
    act(() => root.render(<Host />));
  });

  it("never exposes the archived view without messaging.clearLogs", () => {
    const api: Array<{ setShowArchived: (value: boolean) => void; showArchived: boolean }> = [];

    function Host() {
      const filters = useMessagingWorkFilters({
        searchParams: new URLSearchParams(),
        setSearchParams: vi.fn() as never,
        canViewArchived: false,
      });
      api.push({ setShowArchived: filters.setShowArchived, showArchived: filters.showArchived });
      return null;
    }

    const { root } = renderHost(() => <Host />);
    act(() => api.at(-1)?.setShowArchived(true));
    expect(api.at(-1)?.showArchived).toBe(false);
    act(() => root.render(<Host />));
  });
});
