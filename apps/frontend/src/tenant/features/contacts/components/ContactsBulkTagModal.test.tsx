import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsBulkTagModal } from "./ContactsBulkTagModal";

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({
    open,
    title,
    children,
    saveLabel,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
    saveLabel?: string;
  }) =>
    open ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        <div>{children}</div>
        <button type="button">{saveLabel}</button>
      </div>
    ) : null,
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      return key;
    },
  }),
}));

describe("ContactsBulkTagModal Component", () => {
  it("renders modal with tag input and action buttons when open", () => {
    const html = renderToStaticMarkup(
      <ContactsBulkTagModal open={true} onClose={vi.fn()} selectedCount={4} onConfirm={vi.fn()} />,
    );

    expect(html).toContain("contacts.bulkTagTitle");
    expect(html).toContain("contacts.selectedCount:4");
    expect(html).toContain("contacts.bulkTagAdd");
  });

  it("returns null when open is false", () => {
    const html = renderToStaticMarkup(
      <ContactsBulkTagModal open={false} onClose={vi.fn()} selectedCount={4} onConfirm={vi.fn()} />,
    );

    expect(html).toBe("");
  });
});
