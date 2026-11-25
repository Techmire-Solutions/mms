import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider, queryOptions, type QueryClient } from "@tanstack/react-query";
import { toStoredNotificationItem, useStoredNotifications } from "./useStoredNotifications";
import type { TenantNotificationRecord } from "@mms/contracts";
import { createTestQueryClient } from "@/test/queryClientTestUtils";

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${JSON.stringify(params)}` : key;

const mocks = vi.hoisted(() => ({
  queryFn: vi.fn(),
  markOne: vi.fn(),
  markAll: vi.fn(),
  invalidate: vi.fn(),
  isAuthenticated: true,
}));

vi.mock("@/lib/query/notificationQueries", () => ({
  storedNotificationsQueryOptions: () =>
    queryOptions({
      queryKey: ["auth", "notifications", "stored"],
      queryFn: mocks.queryFn,
      staleTime: 60_000,
    }),
  markStoredNotificationRead: mocks.markOne,
  markAllStoredNotificationsRead: mocks.markAll,
  invalidateStoredNotificationsQueries: mocks.invalidate,
}));
vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t, language: "en" }),
}));
vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: mocks.isAuthenticated }),
}));

function record(id: string, read: boolean): TenantNotificationRecord {
  return {
    id,
    kind: "task_assigned",
    entityType: "task",
    entityId: "t1",
    subjectLabel: "Subject",
    contextLabel: "Context",
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    read,
  };
}

function renderHook(client: QueryClient) {
  let result!: ReturnType<typeof useStoredNotifications>;
  function Harness() {
    result = useStoredNotifications();
    return null;
  }
  const div = document.createElement("div");
  const root = createRoot(div);
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  return {
    current: () => result,
    unmount: () => act(() => root.unmount()),
  };
}

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe("toStoredNotificationItem", () => {
  it("given a stored waitlist seat offer, should render it as an Admissions notification", () => {
    // Arrange
    const record = {
      id: "n1",
      kind: "waitlist_seat_offered" as const,
      entityType: "registration_application",
      entityId: "app-1",
      subjectLabel: "Amina Khan (APP-7K2QX9MD)",
      contextLabel: "Hifz A",
      createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
      read: false,
    };

    // Act
    const item = toStoredNotificationItem(record, t, "en");

    // Assert
    expect(item).toMatchObject({
      id: "stored:n1",
      storedId: "n1",
      type: "admission",
      title: "notifications.waitlistSeatOfferedTitle",
      target: { kind: "admissions" },
      read: false,
    });
    expect(item.desc).toContain("Amina Khan (APP-7K2QX9MD)");
    expect(item.desc).toContain("Hifz A");
    expect(item.time).toMatch(/2 minutes ago/);
  });
});

describe("useStoredNotifications", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = createTestQueryClient();
    mocks.queryFn.mockReset();
    mocks.queryFn.mockResolvedValue({
      notifications: [record("n1", true), record("n2", false)],
      unreadCount: 1,
    });
    mocks.markOne.mockReset();
    mocks.markOne.mockResolvedValue(undefined);
    mocks.markAll.mockReset();
    mocks.markAll.mockResolvedValue(undefined);
    mocks.invalidate.mockReset();
    mocks.isAuthenticated = true;
  });

  it("does not request stored notifications while the session is unauthenticated", async () => {
    mocks.isAuthenticated = false;
    const { unmount } = renderHook(client);
    await flush();

    expect(mocks.queryFn).not.toHaveBeenCalled();
    unmount();
  });

  it("never re-posts a read receipt for an already-read notification", async () => {
    // Regression: the popover re-marked a read item on every click, re-POSTing
    // /read and churning the server unread state.
    client.setQueryData(["auth", "notifications", "stored"], {
      notifications: [record("n1", true), record("n2", false)],
      unreadCount: 1,
    });
    const { current, unmount } = renderHook(client);
    await flush();

    act(() => {
      current().markRead("n1");
    });
    await flush();

    expect(mocks.markOne).not.toHaveBeenCalled();
    unmount();
  });

  it("posts a read receipt for an unread notification exactly once", async () => {
    client.setQueryData(["auth", "notifications", "stored"], {
      notifications: [record("n1", true), record("n2", false)],
      unreadCount: 1,
    });
    const { current, unmount } = renderHook(client);
    await flush();

    act(() => {
      current().markRead("n2");
      current().markRead("n2");
    });
    await flush();

    expect(mocks.markOne).toHaveBeenCalledTimes(1);
    expect(mocks.markOne.mock.calls[0][0]).toBe("n2");
    unmount();
  });

  it("marks all read only when an unread notification exists", async () => {
    client.setQueryData(["auth", "notifications", "stored"], {
      notifications: [record("n1", true), record("n2", false)],
      unreadCount: 1,
    });
    const { current, unmount } = renderHook(client);
    await flush();

    act(() => {
      current().markAllRead();
    });
    await flush();
    expect(mocks.markAll).toHaveBeenCalledTimes(1);

    act(() => {
      client.setQueryData(["auth", "notifications", "stored"], {
        notifications: [record("n1", true)],
        unreadCount: 0,
      });
    });
    await flush();
    act(() => {
      current().markAllRead();
    });
    await flush();
    expect(mocks.markAll).toHaveBeenCalledTimes(1);
    unmount();
  });
});
