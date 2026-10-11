import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactsSyncConflictDiffBody } from "./ContactsSyncConflictDiffBody";

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactsSyncConflictDiffBody Component", () => {
  it("renders diffs table and resolution buttons", () => {
    const html = renderToStaticMarkup(
      <ContactsSyncConflictDiffBody
        local={mockContact}
        serverContact={mockContact}
        serverLoading={false}
        diffs={[{ field: "firstName", local: "Zayd", server: "Zaid" }]}
        fieldPicks={{ firstName: "local" }}
        applying={false}
        onTogglePick={vi.fn()}
        onApplyMerge={vi.fn()}
        onKeepMine={vi.fn()}
        onUseServer={vi.fn()}
        t={((key: string) => key) as never}
      />,
    );

    expect(html).toContain("Zayd");
    expect(html).toContain("Zaid");
    expect(html).toContain("contacts.sync.conflictApplyMerge");
    expect(html).toContain("contacts.sync.conflictKeepLocal");
    expect(html).toContain("contacts.sync.conflictUseServer");
    expect(html).not.toContain("hidden md:block");
  });

  it("renders diffs as cards when viewMode is cards", () => {
    const html = renderToStaticMarkup(
      <ContactsSyncConflictDiffBody
        local={mockContact}
        serverContact={mockContact}
        serverLoading={false}
        diffs={[{ field: "firstName", local: "Zayd", server: "Zaid" }]}
        fieldPicks={{ firstName: "local" }}
        applying={false}
        onTogglePick={vi.fn()}
        onApplyMerge={vi.fn()}
        onKeepMine={vi.fn()}
        onUseServer={vi.fn()}
        t={((key: string) => key) as never}
        viewMode="cards"
      />,
    );

    expect(html).toContain("Zayd");
    expect(html).toContain("Zaid");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("md:hidden");
  });
});
