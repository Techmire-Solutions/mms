import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  StudentDetailSiblingsSection,
  type SiblingStudentItem,
} from "./StudentDetailSiblingsSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "students.detail.siblings": "Siblings",
      };
      return labels[key] ?? key;
    },
  }),
}));

const mockSiblings: SiblingStudentItem[] = [
  {
    id: "sib-1",
    name: "Hussein Ali",
    grNumber: "GR-204",
    status: "active",
    gender: "male",
    sessionNames: ["Tahfeez Morning", "Tajweed Advanced"],
  },
  {
    id: "sib-2",
    name: "Fatima Ali",
    status: "active",
    gender: "female",
    sessionNames: [],
  },
];

const mockStatusBadgeConfig = {
  active: { label: "Active", cls: "bg-success/10 text-success" },
};

describe("StudentDetailSiblingsSection Component", () => {
  it("returns null when siblings array is empty", () => {
    const html = renderToStaticMarkup(
      <StudentDetailSiblingsSection siblings={[]} statusBadgeConfig={mockStatusBadgeConfig} />,
    );
    expect(html).toBe("");
  });

  it("renders sibling list with count, names, GR badge, and session names", () => {
    const html = renderToStaticMarkup(
      <StudentDetailSiblingsSection
        siblings={mockSiblings}
        statusBadgeConfig={mockStatusBadgeConfig}
        onViewSibling={vi.fn()}
      />,
    );

    expect(html).toContain("Siblings");
    expect(html).toContain(">2<");
    expect(html).toContain("Hussein Ali");
    expect(html).toContain("GR-204");
    expect(html).toContain("Tahfeez Morning, Tajweed Advanced");
    expect(html).toContain("Fatima Ali");
    expect(html).toContain('<button type="button"');
    expect(html).toContain("lucide-chevron-right");
  });

  it("omits interactive button semantics when onViewSibling is not provided", () => {
    const html = renderToStaticMarkup(
      <StudentDetailSiblingsSection
        siblings={mockSiblings}
        statusBadgeConfig={mockStatusBadgeConfig}
      />,
    );

    expect(html).toContain("Hussein Ali");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("lucide-chevron-right");
  });
});
