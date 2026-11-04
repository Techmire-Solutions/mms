import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@mms/shared";
import { MessagingWorkTierDirectory } from "./MessagingWorkTierDirectory";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/ModuleWorkListStateShell", () => ({
  ModuleWorkListStateShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="list-shell">{children}</div>
  ),
}));

vi.mock("@/components/app/ModuleWorkDirectoryEmpty", () => ({
  ModuleWorkDirectoryEmpty: ({
    title,
    description,
    firstRunAction,
  }: {
    title: string;
    description: string;
    firstRunAction?: React.ReactNode;
  }) => (
    <div data-testid="empty">
      <span>{title}</span>
      <span>{description}</span>
      <span data-testid="first-run">{firstRunAction ? "cta" : "none"}</span>
    </div>
  ),
}));

vi.mock("./MessagingListFilters", () => ({
  MessagingListFilters: () => <div data-testid="filters" />,
}));

vi.mock("./MessagingListDesktopTable", () => ({
  MessagingListDesktopTable: () => <div data-testid="table" />,
}));

vi.mock("./MessagingListCards", () => ({
  MessagingListCards: () => <div data-testid="cards" />,
}));

vi.mock("./MessagingDetail", () => ({
  MessagingDetail: () => null,
}));

vi.mock("./MessagingWorkBulkActionBar", () => ({
  MessagingWorkBulkActionBar: (props: {
    viewingDeleted?: boolean;
    canRestoreLogs?: boolean;
    selectedCount: number;
  }) => (
    <div
      data-testid="bulk-bar"
      data-viewing-deleted={String(props.viewingDeleted)}
      data-can-restore={String(props.canRestoreLogs)}
    >
      {props.selectedCount}
    </div>
  ),
}));

const LOG: Message = {
  id: "msg-1",
  userId: "u-1",
  contactId: "c-1",
  channel: "sms",
  body: "Salaam",
  sentAt: "2026-11-04T10:00:00.000Z",
  status: "sent",
  category: "general",
};

function controller(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    t: (key: string) => key,
    viewMode: "table",
    setViewMode: vi.fn(),
    search: "",
    setSearch: vi.fn(),
    channel: "all",
    setChannel: vi.fn(),
    channelSelectOptions: [],
    status: "all",
    setStatus: vi.fn(),
    statusOptions: [],
    category: "all",
    setCategory: vi.fn(),
    categorySelectOptions: [],
    startDate: "",
    setStartDate: vi.fn(),
    endDate: "",
    setEndDate: vi.fn(),
    hasActiveFilters: false,
    activeFilterCount: 0,
    clearFilters: vi.fn(),
    columnRegistry: [],
    updateUserColumnLayout: vi.fn(),
    customizerLabels: {},
    filterChips: [],
    logsQuery: {
      logs: [LOG],
      total: 1,
      page: 1,
      pageSize: 50,
      hasMore: false,
      isError: false,
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    },
    showArchived: false,
    canViewArchived: true,
    setShowArchived: vi.fn(),
    failedLogs: [],
    hasBulkResend: true,
    handleBulkResendLogs: vi.fn(),
    selectedCount: 0,
    selectedById: {},
    setSelectedById: vi.fn(),
    logStatusConfig: {},
    getRecipientName: () => "Guardian",
    isColumnVisible: () => true,
    getColumnWidth: () => undefined,
    setColumnWidth: vi.fn(),
    focusedLogId: null,
    toggleLog: vi.fn(),
    toggleAllVisible: vi.fn(),
    handleResendLog: vi.fn(),
    handleOpenDetail: vi.fn(),
    handleCloseDetail: vi.fn(),
    handleBulkResend: vi.fn(),
    handleExportLogs: vi.fn(),
    activeDetailLog: null,
    activeRecipient: null,
    ...overrides,
  };
}

describe("MessagingWorkTierDirectory", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function renderDirectory(overrides: Record<string, unknown> = {}): void {
    const props = {
      ...controller(overrides),
      canWrite: true,
      canClearLogs: true,
      canRestoreLogs: true,
      onRestoreLog: vi.fn(),
      onBulkRestore: vi.fn(),
      onClearLogsRequest: vi.fn(),
      onStartCampaign: vi.fn(),
    };
    act(() => {
      root.render(
        <MessagingWorkTierDirectory
          {...(props as unknown as React.ComponentProps<typeof MessagingWorkTierDirectory>)}
        />,
      );
    });
  }

  it("labels the archived view and offers a way back to active logs", () => {
    renderDirectory({ showArchived: true });

    expect(container.textContent).toContain("messaging.showArchived");
    expect(container.textContent).toContain("messaging.showActiveLogs");
  });

  it("uses archived empty copy without the campaign CTA", () => {
    renderDirectory({
      showArchived: true,
      logsQuery: {
        logs: [],
        total: 0,
        page: 1,
        pageSize: 50,
        hasMore: false,
        isError: false,
        isPending: false,
        isFetching: false,
        refetch: vi.fn(),
      },
    });

    expect(container.textContent).toContain("messaging.archivedEmpty");
    expect(container.textContent).toContain("messaging.archivedEmptyDesc");
    expect(container.textContent).not.toContain("messaging.selectRecipientsDesc");
    expect(container.querySelector('[data-testid="first-run"]')?.textContent).toBe("none");
  });

  it("scopes the failed count to the page", () => {
    renderDirectory({
      status: "failed",
      failedLogs: [{ ...LOG, status: "failed" }],
      logsQuery: {
        logs: [{ ...LOG, status: "failed" }],
        total: 1,
        page: 1,
        pageSize: 50,
        hasMore: false,
        isError: false,
        isPending: false,
        isFetching: false,
        refetch: vi.fn(),
      },
    });

    expect(container.textContent).toContain("messaging.failedOnPage");
  });

  it("switches the bulk bar into restore mode for archived selections", () => {
    renderDirectory({
      showArchived: true,
      selectedCount: 1,
      selectedById: { "msg-1": LOG },
    });

    const bar = container.querySelector('[data-testid="bulk-bar"]');
    expect(bar?.getAttribute("data-viewing-deleted")).toBe("true");
    expect(bar?.getAttribute("data-can-restore")).toBe("true");
  });
});
