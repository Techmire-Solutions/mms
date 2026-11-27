import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SystemUser } from "@mms/contracts";

/**
 * Regression: the bulk bar derived recipients by intersecting the CURRENT page's
 * rows with `selectedIds`. Selection survives paging, so users picked on page 1
 * disappeared from the message composer while still counting as selected. UsersList
 * must keep a cross-page snapshot of the selected row objects.
 */

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@mms/fe-core/tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/fe-core/tenant")>();
  return {
    ...actual,

    useWorkDirectoryViewMode: () => ({ viewMode: "table", setViewMode: vi.fn() }),
  };
});

vi.mock("../host/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ dateFormat: "yyyy-MM-dd" }),
}));

vi.mock("../host/useWorkspaceRoles", () => ({
  useWorkspaceRoles: () => [],
}));

vi.mock("@mms/fe-core/components/ModuleWorkListStateShell", () => ({
  ModuleWorkListStateShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("./UsersListFilters", () => ({
  UsersListFilters: () => null,
}));

vi.mock("./UsersListContent", () => ({
  UsersListContent: ({
    users,
    onToggleSelect,
  }: {
    users: SystemUser[];
    onToggleSelect: (id: string) => void;
  }) => (
    <div>
      {users.map((user) => (
        <button
          key={user.id}
          type="button"
          data-testid={`toggle-${user.id}`}
          onClick={() => onToggleSelect(user.id)}
        >
          {user.id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("./UsersBulkActionBar", () => ({
  UsersBulkActionBar: ({
    selectedUsers,
    onMessage,
  }: {
    selectedUsers: SystemUser[];
    onMessage?: (channel: "sms" | "whatsapp" | "email", users: SystemUser[]) => void;
  }) => (
    <div>
      <span data-testid="selected-users">{selectedUsers.map((user) => user.id).join(",")}</span>
      <button
        type="button"
        data-testid="bulk-message"
        onClick={() => onMessage?.("sms", selectedUsers)}
      >
        message
      </button>
    </div>
  ),
}));

import { UsersList } from "./UsersList";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const pageOne = [
  { id: "usr-1", name: "Ayesha", role: "teacher", status: "active" },
] as unknown as SystemUser[];
const pageTwo = [
  { id: "usr-2", name: "Bilal", role: "teacher", status: "active" },
] as unknown as SystemUser[];

function Harness({ onMessage }: { onMessage: (users: SystemUser[]) => void }) {
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  return (
    <div>
      <button type="button" data-testid="next-page" onClick={() => setPage(2)}>
        next
      </button>
      <UsersList
        users={page === 1 ? pageOne : pageTwo}
        listPage={page}
        onPageChange={setPage}
        search=""
        roleFilter="all"
        statusFilter="all"
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onSearchChange={vi.fn()}
        onRoleFilterChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onRestore={vi.fn()}
        onBulkDelete={vi.fn()}
        onBulkRestore={vi.fn()}
        onResetPassword={vi.fn()}
        onAddUser={vi.fn()}
        onMessage={(_channel, users) => onMessage(users)}
      />
    </div>
  );
}

describe("UsersList cross-page bulk message recipients", () => {
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

  it("keeps a user selected on page 1 when another is selected on page 2", async () => {
    const onMessage = vi.fn();
    await act(async () => {
      root.render(<Harness onMessage={onMessage} />);
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="toggle-usr-1"]')?.click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="next-page"]')?.click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="toggle-usr-2"]')?.click();
    });

    expect(container.querySelector('[data-testid="selected-users"]')?.textContent).toBe(
      "usr-1,usr-2",
    );

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="bulk-message"]')?.click();
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    const recipients = onMessage.mock.calls[0]?.[0] as SystemUser[];
    expect(recipients.map((user) => user.id)).toEqual(["usr-1", "usr-2"]);
  });
});
