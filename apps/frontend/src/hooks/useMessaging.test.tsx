import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import {
  MESSAGING_LOGS_QUERY_KEY,
  MESSAGING_METRICS_QUERY_KEY,
  MESSAGING_TEMPLATES_QUERY_KEY,
  invalidateMessagingQueries,
  useMessageLogs,
  useMessageTemplates,
  useMessagingMetrics,
  useMessagingMutations,
} from "./useMessaging";

const mockUseQuery = vi.fn();
const mockSaveTemplateMutation = { mutateAsync: vi.fn() };
const mockDeleteTemplateMutation = { mutateAsync: vi.fn() };
const mockRecordLogsMutation = { mutateAsync: vi.fn() };
const mockClearLogsMutation = { mutateAsync: vi.fn() };
const mockRestoreLogsMutation = { mutateAsync: vi.fn() };

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: "u-1" } }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/lib/apiErrorNotify", () => ({
  notifyApiFailure: vi.fn(),
}));

vi.mock("@/hooks/useMessagingDispatch", () => ({
  useMessagingDispatchMutations: () => ({
    dispatchServerSms: { mutateAsync: vi.fn() },
    dispatchServerEmail: { mutateAsync: vi.fn() },
    dispatchServerWhatsApp: { mutateAsync: vi.fn() },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  tsrClient: {
    messaging: {
      listTemplates: {
        useQuery: (...args: unknown[]) => mockUseQuery("listTemplates", ...args),
      },
      listLogs: {
        useQuery: (...args: unknown[]) => mockUseQuery("listLogs", ...args),
      },
      getMetrics: {
        useQuery: (...args: unknown[]) => mockUseQuery("getMetrics", ...args),
      },
      saveTemplate: {
        useMutation: (opts?: { onSuccess?: () => void; onError?: (e: unknown) => void }) => {
          opts?.onSuccess?.();
          opts?.onError?.(new Error("fail"));
          return mockSaveTemplateMutation;
        },
      },
      deleteTemplate: {
        useMutation: (opts?: { onSuccess?: () => void }) => {
          opts?.onSuccess?.();
          return mockDeleteTemplateMutation;
        },
      },
      recordLogs: {
        useMutation: (opts?: { onSuccess?: () => void }) => {
          opts?.onSuccess?.();
          return mockRecordLogsMutation;
        },
      },
      clearLogs: {
        useMutation: (opts?: { onSuccess?: () => void }) => {
          opts?.onSuccess?.();
          return mockClearLogsMutation;
        },
      },
      restoreLogs: {
        useMutation: (opts?: { onSuccess?: () => void }) => {
          opts?.onSuccess?.();
          return mockRestoreLogsMutation;
        },
      },
    },
  },
}));

function renderHookHelper<T>(useHook: () => T) {
  let current!: T;
  const container = document.createElement("div");
  const root = createRoot(container);

  function Host() {
    current = useHook();
    return null;
  }

  act(() => {
    root.render(<Host />);
  });

  return {
    get current() {
      return current;
    },
    rerender() {
      act(() => {
        root.render(<Host key={Math.random()} />);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe("useMessaging hooks", () => {
  it("invalidateMessagingQueries invalidates all messaging query keys", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidateMessagingQueries(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: MESSAGING_TEMPLATES_QUERY_KEY });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: MESSAGING_LOGS_QUERY_KEY });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: MESSAGING_METRICS_QUERY_KEY });
  });

  it("useMessageTemplates returns stable empty array reference on empty or loading state", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const hook = renderHookHelper(() => useMessageTemplates());
    const firstRef = hook.current.templates;
    expect(firstRef).toEqual([]);

    hook.rerender();
    expect(hook.current.templates).toBe(firstRef);
    hook.unmount();
  });

  it("useMessageTemplates returns templates list on status 200", () => {
    const templates = [{ id: "t1", name: "Welcome", body: "Hello", channel: "sms" as const }];
    mockUseQuery.mockReturnValue({
      data: { status: 200, body: { templates } },
      isLoading: false,
    });

    const hook = renderHookHelper(() => useMessageTemplates());
    expect(hook.current.templates).toEqual(templates);
    hook.unmount();
  });

  it("useMessageLogs returns stable empty logs reference and default pagination", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const hook = renderHookHelper(() =>
      useMessageLogs({ channel: "sms", category: "attendance", search: "ali", status: "sent" }),
    );

    const firstLogsRef = hook.current.logs;
    expect(firstLogsRef).toEqual([]);
    expect(hook.current.total).toBe(0);
    expect(hook.current.page).toBe(1);
    expect(hook.current.hasMore).toBe(false);

    hook.rerender();
    expect(hook.current.logs).toBe(firstLogsRef);
    hook.unmount();
  });

  it("useMessageLogs returns loaded logs with pagination", () => {
    const logs = [{ id: "log-1", recipient: "+12345", body: "msg", status: "sent" }];
    mockUseQuery.mockReturnValue({
      data: {
        status: 200,
        body: { logs, total: 10, page: 2, pageSize: 5, hasMore: true },
      },
      isLoading: false,
    });

    const hook = renderHookHelper(() => useMessageLogs({ page: 2, pageSize: 5 }));
    expect(hook.current.logs).toEqual(logs);
    expect(hook.current.total).toBe(10);
    expect(hook.current.page).toBe(2);
    expect(hook.current.pageSize).toBe(5);
    expect(hook.current.hasMore).toBe(true);
    hook.unmount();
  });

  it("useMessagingMetrics returns data when available", () => {
    const metrics = { totalSent: 100, delivered: 95, failed: 5 };
    mockUseQuery.mockReturnValue({
      data: { status: 200, body: { metrics } },
      isLoading: false,
    });

    const hook = renderHookHelper(() =>
      useMessagingMetrics({ startDate: "2026-01-01", endDate: "2026-01-31" }),
    );
    expect(hook.current.metrics).toEqual(metrics);
    hook.unmount();
  });

  it("useMessagingMutations provides wrapped mutation helpers", async () => {
    const hook = renderHookHelper(() => useMessagingMutations());

    await hook.current.deleteTemplate.mutateAsync("t1");
    expect(mockDeleteTemplateMutation.mutateAsync).toHaveBeenCalledWith({
      params: { id: "t1" },
    });

    await hook.current.clearLogs.mutateAsync();
    expect(mockClearLogsMutation.mutateAsync).toHaveBeenCalledWith({ body: {} });

    await hook.current.restoreLogs.mutateAsync(["log-1"]);
    expect(mockRestoreLogsMutation.mutateAsync).toHaveBeenCalledWith({
      body: { ids: ["log-1"] },
    });

    await hook.current.restoreLogs.mutateAsync();
    expect(mockRestoreLogsMutation.mutateAsync).toHaveBeenCalledWith({ body: {} });
    hook.unmount();
  });
});
