import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Student } from "@mms/shared";
import { StudentDetailHeroCard } from "./StudentDetailHeroCard";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockStudent: Student = {
  id: "std-hero-1",
  contactId: "cnt-std-1",
  name: "Ali Raza",
  gender: "male",
  grNumber: "GR-550",
  status: "active",
  dob: "2010-05-15",
  contactRelationships: [],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockStatusConfig = {
  active: { label: "Active", cls: "bg-success/10 text-success" },
};

describe("StudentDetailHeroCard Component", () => {
  it("renders student name, GR badge, and status badge via StudentDetailHeroCard", () => {
    const html = renderToStaticMarkup(
      <StudentDetailHeroCard student={mockStudent} statusBadgeConfig={mockStatusConfig} />,
    );

    expect(html).toContain("Ali Raza");
    expect(html).toContain("GR-550");
    expect(html).toContain("Active");
  });

  it("omits GR badge when grNumber is absent", () => {
    const studentWithoutGr: Student = {
      ...mockStudent,
      grNumber: undefined,
    };

    const html = renderToStaticMarkup(
      <StudentDetailHeroCard student={studentWithoutGr} statusBadgeConfig={mockStatusConfig} />,
    );

    expect(html).toContain("Ali Raza");
    expect(html).not.toContain("GR-");
  });
});
