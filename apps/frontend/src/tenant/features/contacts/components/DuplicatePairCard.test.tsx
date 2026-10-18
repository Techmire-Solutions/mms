import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import type { DuplicatePair } from "../lib/duplicateDetectionTypes";
import { DuplicatePairCard } from "./DuplicatePairCard";

vi.mock("@/tenant/features/contacts/components/DuplicateDetectionParts", () => ({
  ConfidenceBadge: ({ score }: { score: number }) => (
    <div data-testid="confidence-badge">{score}%</div>
  ),
  DuplicateContactCard: ({ contact, label }: { contact: Contact; label: string }) => (
    <div data-testid="contact-card">
      {label}: {contact.name}
    </div>
  ),
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

describe("DuplicatePairCard Component", () => {
  it("renders pair header and contact cards", () => {
    const html = renderToStaticMarkup(
      <DuplicatePairCard
        pair={mockPair}
        prefs={{}}
        selectedKeepIndex={0}
        canWrite={true}
        onMerge={vi.fn()}
        onDismiss={vi.fn()}
        onSelectKeep={vi.fn()}
        t={((key: string) => key) as never}
      />,
    );

    expect(html).toContain("90%");
    expect(html).toContain("Matched phone");
    expect(html).toContain("contacts.duplicates.merge");
  });
});
