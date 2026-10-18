import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Step4ClassAssignment } from "./Step4ClassAssignment";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

const mockSession = {
  id: "ses-1",
  name: "Spring 2025",
  classes: [
    {
      id: "cls-1",
      name: "Class 1A",
      capacity: 20,
      enrolled: 10,
      ageMin: 7,
      ageMax: 12,
      gender: "male",
      facultyName: "Ustadh Khalid",
    },
  ],
} as any;

describe("Step4ClassAssignment Component", () => {
  it("renders classes list and capacity bar", () => {
    const html = renderToStaticMarkup(
      <Step4ClassAssignment
        session={mockSession}
        student={null}
        suggestedClass={mockSession.classes[0]}
        value={null}
        onChange={vi.fn()}
        placement={{ sectionId: "", rollNo: "" }}
        onPlacementChange={vi.fn()}
      />,
    );

    expect(html).toContain("Class 1A");
    expect(html).toContain("Ustadh Khalid");
    expect(html).toContain("10/20");
  });
});
