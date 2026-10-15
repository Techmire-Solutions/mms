import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { AppleContactsPreviewList } from "./AppleContactsPreviewList";

const mockContacts: Contact[] = [
  {
    id: "cnt-1",
    name: "Zayd Harith",
    firstName: "Zayd",
    lastName: "Harith",
    phones: [{ number: "3001234567", label: "Mobile" }],
    type: "student",
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

describe("AppleContactsPreviewList Component", () => {
  it("renders preview list items and import buttons", () => {
    const html = renderToStaticMarkup(
      <AppleContactsPreviewList
        previewList={mockContacts}
        importing={false}
        onClear={vi.fn()}
        onImport={vi.fn()}
        onChooseDifferent={vi.fn()}
        t={((k: string) => k) as unknown as never}
      />,
    );

    expect(html).toContain("Zayd Harith");
    expect(html).toContain("3001234567");
    expect(html).toContain("contacts.sync.chooseDifferentFile");
  });
});
