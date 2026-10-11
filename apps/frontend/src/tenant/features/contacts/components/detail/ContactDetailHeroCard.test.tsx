import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetailHeroCard } from "./ContactDetailHeroCard";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "contacts.table.yesSyed": "Syed",
        "contacts.gender.male": "Male",
        "contacts.detail.aiIntelligence": "AI Intelligence",
        "contacts.columns.notes": "Notes",
      };
      return labels[key] ?? key;
    },
  }),
}));

const mockContact: Contact = {
  id: "cnt-hero-1",
  name: "Dr. Hassan Reza",
  firstName: "Hassan",
  lastName: "Reza",
  gender: "male",
  isSyed: true,
  tags: ["VIP", "Donor"],
  aiSummary: "Key patron and volunteer coordinator for community events.",
  notes: "Prefers communication in afternoon hours.",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactDetailHeroCard Component", () => {
  it("renders hero card with display name, Syed badge, tags, AI summary, and notes", () => {
    const html = renderToStaticMarkup(<ContactDetailHeroCard contact={mockContact} />);

    expect(html).toContain("Dr. Hassan Reza");
    expect(html).toContain("Male");
    expect(html).toContain("Syed");
    expect(html).toContain("VIP");
    expect(html).toContain("Donor");
    expect(html).toContain("AI Intelligence");
    expect(html).toContain("Key patron and volunteer coordinator");
    expect(html).toContain("Notes");
    expect(html).toContain("Prefers communication in afternoon hours.");
  });

  it("omits AI intelligence and notes sections when absent", () => {
    const minimalContact: Contact = {
      id: "cnt-hero-2",
      name: "Simple Contact",
      firstName: "Simple",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    const html = renderToStaticMarkup(<ContactDetailHeroCard contact={minimalContact} />);

    expect(html).toContain("Simple Contact");
    expect(html).not.toContain("AI Intelligence");
    expect(html).not.toContain("Notes");
  });
});
