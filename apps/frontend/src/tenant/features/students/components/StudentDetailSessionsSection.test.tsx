import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Session } from "@mms/shared";
import { StudentDetailSessionsSection } from "./StudentDetailSessionsSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      if (params?.name && params?.teacher) return `${params.name} (${params.teacher})`;
      if (params?.amount) return `${key}:${params.amount}`;
      return key;
    },
  }),
}));

const mockSession: Session = {
  id: "ses-detail-1",
  name: "Quran Hifz Morning 2024",
  type: "academic",
  status: "active",
  startDate: "2024-01-01",
  endDate: "2024-12-31",
  baseFee: 100,
  currency: "USD",
  faculty: [],
  classes: [
    {
      id: "cls-1",
      name: "Class A",
      facultyId: "fac-1",
      facultyName: "Ustadh Umar",
      room: "Room 101",
      ageMin: 5,
      ageMax: 15,
      gender: "mixed",
      maxStudents: 20,
      enrolled: 15,
    } as unknown as never,
  ],
  createdAt: "2024-01-01T00:00:00Z",

  updatedAt: "2024-01-01T00:00:00Z",
};

describe("StudentDetailSessionsSection Component", () => {
  it("renders enrolled session cards with class details", () => {
    const html = renderToStaticMarkup(<StudentDetailSessionsSection sessions={[mockSession]} />);

    expect(html).toContain("Quran Hifz Morning 2024");
    expect(html).toContain("Class A (Ustadh Umar)");
    expect(html).toContain("students.detail.classRoom");
  });

  it("renders empty state when sessions list is empty", () => {
    const html = renderToStaticMarkup(<StudentDetailSessionsSection sessions={[]} />);

    expect(html).toContain("students.detail.notEnrolled");
  });

  it("renders error state when error is true", () => {
    const html = renderToStaticMarkup(<StudentDetailSessionsSection sessions={[]} error={true} />);

    expect(html).toContain("students.loadFailed");
  });
});
