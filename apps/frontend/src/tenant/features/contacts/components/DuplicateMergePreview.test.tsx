import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import type { DuplicatePair } from "./duplicateDetectionTypes";
import { MergePreview } from "./DuplicateMergePreview";

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({
    open,
    title,
    children,
    footer,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    ) : null,
}));

vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => ({
    prefs: {
      duplicateDetectionFields: ["name", "phone"],
    },
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockContactA: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  phone: "+92 300 1234567",
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockContactB: Contact = {
  id: "cnt-2",
  name: "Zaid Harith",
  firstName: "Zaid",
  lastName: "Harith",
  phone: "+92 300 1234567",
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockPair: DuplicatePair = {
  id: "pair-1",
  confidence: 90,
  reason: "Matched phone",
  contacts: [mockContactA, mockContactB],
};

describe("DuplicateMergePreview Component", () => {
  it("renders merge preview modal with resolved fields", () => {
    const html = renderToStaticMarkup(
      <MergePreview pair={mockPair} keepIndex={0} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(html).toContain("contacts.duplicates.mergePreview");
    expect(html).toContain("contacts.duplicates.confirmMerge");
  });
});
