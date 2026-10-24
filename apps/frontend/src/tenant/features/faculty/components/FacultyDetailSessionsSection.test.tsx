import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FacultyAssignedClassItem } from "@/lib/faculty/facultyAssignment";
import { FacultyDetailSessionsSection } from "./FacultyDetailSessionsSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      if (params?.room) return `Room ${params.room}`;
      return key;
    },
  }),
}));

const mockAssignedClass: FacultyAssignedClassItem = {
  sessionId: "ses-1",
  sessionName: "Quran Hifz Morning",
  sessionType: "academic",
  sessionStatus: "active",
  classId: "cls-1",
  className: "Tajweed Advanced",
  room: "101",
  enrolled: 15,
  capacity: 20,
};

describe("FacultyDetailSessionsSection Component", () => {
  it("renders assigned class card with room and enrollment count", () => {
    const html = renderToStaticMarkup(
      <FacultyDetailSessionsSection assignedClasses={[mockAssignedClass]} />,
    );

    expect(html).toContain("Tajweed Advanced");
    expect(html).toContain("Quran Hifz Morning");
    expect(html).toContain("Room 101");
  });

  it("renders empty state when assignedClasses is empty", () => {
    const html = renderToStaticMarkup(<FacultyDetailSessionsSection assignedClasses={[]} />);

    expect(html).toContain("faculty.detail.noAssignedClasses");
  });

  it("renders error state when error is true", () => {
    const html = renderToStaticMarkup(
      <FacultyDetailSessionsSection assignedClasses={[]} error={true} />,
    );

    expect(html).toContain("faculty.loadFailed");
  });
});
