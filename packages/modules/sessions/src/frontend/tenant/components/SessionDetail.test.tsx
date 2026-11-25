import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../lib/sessionsData";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const h = vi.hoisted(() => ({
  permissions: { canWrite: true, canOverrideLock: false },
  tabCanWrite: undefined as boolean | undefined,
}));

vi.mock("@mms/fe-core/i18n", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock("../host/useAcademicTerms", () => ({
  useAcademicTerms: () => ({ class: { plural: "Classes" } }),
}));
vi.mock("../host/usePermissions", () => ({
  useModulePermissions: () => h.permissions,
}));
vi.mock("../hooks/sessionLifecycleDisplay", () => ({
  sessionLifecycleDisplay: () => ({ statusConfig: {} }),
}));
vi.mock("@mms/fe-core/components/DetailDrawerShell", () => ({
  DetailDrawerShell: ({
    children,
    subtitle,
    headerActions,
    headerExtra,
  }: {
    children: React.ReactNode;
    subtitle?: React.ReactNode;
    headerActions?: React.ReactNode;
    headerExtra?: React.ReactNode;
  }) => (
    <div>
      {subtitle}
      {headerActions}
      {headerExtra}
      {children}
    </div>
  ),
}));
vi.mock("@mms/fe-core/components/DetailDrawerArchiveChrome", () => ({
  DetailDrawerRestoreOrEditAction: ({ canEdit }: { canEdit: boolean }) =>
    canEdit ? <button data-testid="edit-session" /> : null,
  DrawerSyncStatusFooter: () => null,
}));
vi.mock("@mms/fe-core/components/StatusBadge", () => ({ StatusBadge: () => null }));
vi.mock("@mms/ui/app/SubTabBar", () => ({ SubTabBar: () => null }));
vi.mock("./SessionArchivedBanner", () => ({
  SessionArchivedBanner: () => null,
}));
vi.mock("./SessionLifecycleBar", () => ({
  SessionLifecycleBar: () => null,
}));
vi.mock("./tabs/ClassesTab", () => ({
  ClassesTab: ({ canWrite }: { canWrite: boolean }) => {
    h.tabCanWrite = canWrite;
    return <div data-testid="classes-tab" />;
  },
}));
vi.mock("./tabs/FacultyManagementTab", () => ({
  FacultyManagementTab: () => null,
}));
vi.mock("./tabs/BudgetTab", () => ({ BudgetTab: () => null }));
vi.mock("./tabs/RegistrationLinksTab", () => ({
  RegistrationLinksTab: () => null,
}));
vi.mock("./tabs/SessionActivityTab", () => ({
  SessionActivityTab: () => null,
}));
vi.mock("./tabs/SessionCompletionTab", () => ({
  SessionCompletionTab: () => null,
}));

import { SessionDetail } from "./SessionDetail";

const described = {
  ...({
    id: "sess-2",
    name: "Described Hifz",
    type: "Hifz",
    status: "open",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    baseFee: 100,
    currency: "PKR",
    classes: [],
    faculty: [],
  } as unknown as Session),
  description: "Evening Hifz program for working students.",
};

const completed = {
  id: "sess-1",
  name: "Completed Hifz",
  type: "Hifz",
  status: "completed",
  startDate: "2025-01-01",
  endDate: "2025-12-31",
  baseFee: 100,
  currency: "PKR",
  classes: [],
  faculty: [],
} as unknown as Session;

describe("SessionDetail terminal-session permissions", () => {
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

  it("shows the session description in the drawer header", async () => {
    h.permissions = { canWrite: true, canOverrideLock: false };
    await act(async () => {
      root.render(
        <SessionDetail session={described} onClose={vi.fn()} onUpdate={vi.fn()} onEdit={vi.fn()} />,
      );
    });
    expect(container.textContent).toContain("Evening Hifz program for working students.");
  });

  it("hides edit and nested editors for a completed session without override rights", async () => {
    h.permissions = { canWrite: true, canOverrideLock: false };
    await act(async () => {
      root.render(
        <SessionDetail session={completed} onClose={vi.fn()} onUpdate={vi.fn()} onEdit={vi.fn()} />,
      );
    });
    expect(container.querySelector("[data-testid='edit-session']")).toBeNull();
    expect(h.tabCanWrite).toBe(false);
  });

  it("keeps edit and nested editors for an override-capable user", async () => {
    h.permissions = { canWrite: true, canOverrideLock: true };
    await act(async () => {
      root.render(
        <SessionDetail session={completed} onClose={vi.fn()} onUpdate={vi.fn()} onEdit={vi.fn()} />,
      );
    });
    expect(container.querySelector("[data-testid='edit-session']")).not.toBeNull();
    expect(h.tabCanWrite).toBe(true);
  });
});
