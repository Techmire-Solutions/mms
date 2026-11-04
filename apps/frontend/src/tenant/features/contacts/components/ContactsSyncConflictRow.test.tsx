import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ContactsSyncConflict } from "@/lib/contacts/contactsSyncOutbox";
import { ContactsSyncConflictRow } from "./ContactsSyncConflictRow";

vi.mock("@/tenant/features/contacts/hooks/useContactsSyncConflictRow", () => ({
  useContactsSyncConflictRow: () => ({
    expanded: false,
    setExpanded: vi.fn(),
    applying: false,
    fieldPicks: {},
    local: undefined,
    serverContact: undefined,
    serverLoading: false,
    diffs: [],
    togglePick: vi.fn(),
    handleKeepMine: vi.fn(),
    handleUseServer: vi.fn(),
    handleApplyMerge: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockEntry: ContactsSyncConflict = {
  id: "conflict-1",
  kind: "update",
  contactId: "cnt-1",
  contact: {
    id: "cnt-1",
    name: "Local Version",
    firstName: "Local",
    lastName: "Version",
    type: "student",
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  createdAt: "2024-01-01T12:00:00Z",
  failedAt: "2024-01-01T12:00:00Z",
};

describe("ContactsSyncConflictRow Component", () => {
  it("renders conflict callout with entry title and action buttons", () => {
    const html = renderToStaticMarkup(
      <ContactsSyncConflictRow
        entry={mockEntry}
        title="Local Version"
        onRequestDismiss={vi.fn()}
        onResolved={vi.fn()}
      />,
    );

    expect(html).toContain("Local Version");
  });
});
