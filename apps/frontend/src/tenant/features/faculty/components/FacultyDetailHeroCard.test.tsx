import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Faculty } from "@mms/shared";
import { FacultyDetailHeroCard } from "./FacultyDetailHeroCard";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockFaculty: Faculty = {
  id: "fac-hero-1",
  contactId: "cnt-fac-1",
  name: "Ustadh Umar",
  status: "active",
  employeeId: "EMP-010",
  gender: "male",
  specialization: "Tajweed",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockStatusConfig = {
  active: { label: "Active", cls: "bg-success/10 text-success" },
};

describe("FacultyDetailHeroCard Component", () => {
  it("renders faculty name, employee ID badge, and status badge via FacultyDetailHeroCard", () => {
    const html = renderToStaticMarkup(
      <FacultyDetailHeroCard
        faculty={mockFaculty}
        displayName="Ustadh Umar"
        statusConfig={mockStatusConfig}
        showStatus={true}
      />,
    );

    expect(html).toContain("Ustadh Umar");
    expect(html).toContain("EMP-010");
    expect(html).toContain("Active");
  });

  it("omits status badge when showStatus is false", () => {
    const html = renderToStaticMarkup(
      <FacultyDetailHeroCard
        faculty={mockFaculty}
        displayName="Ustadh Umar"
        statusConfig={mockStatusConfig}
        showStatus={false}
      />,
    );

    expect(html).toContain("Ustadh Umar");
    expect(html).not.toContain("Active");
  });
});
