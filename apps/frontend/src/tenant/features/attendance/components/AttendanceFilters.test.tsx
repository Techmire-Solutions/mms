import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceFilters } from "./AttendanceFilters";


vi.mock("@/hooks/useAcademicTerms", () => ({
  useAcademicTerms: () => ({
    session: { singular: "Session", plural: "Sessions" },
    class: { singular: "Class", plural: "Classes" },
    section: { singular: "Section", plural: "Sections" },
  }),
}));
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessionsCollection: () => [
    {
      id: "ses-1",
      name: "Spring 2025",
      classes: [{ id: "cls-1", name: "Class 1A" }],
    },
  ],
}));

vi.mock("@/tenant/hooks/collections/faculty", () => {
  const mockList = () => ({
    data: {
      body: {
        faculty: [{ id: "tch-1", name: "Ustadh Khalid", status: "active" }],
      },
    },
  });
  return {
    useFacultyContractList: mockList,
  };
});

describe("AttendanceFilters Component", () => {
  it("renders filter controls for session, class, faculty, and date", () => {
    const html = renderToStaticMarkup(
      <AttendanceFilters
        filters={{
          sessionId: "",
          classId: "",
          facultyId: "",
          date: "2025-01-01",
        }}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain("attendance.filters.title");
    expect(html).toContain("attendance.filters.session");
    expect(html).toContain("attendance.filters.class");
    expect(html).toContain("attendance.filters.faculty");
    expect(html).toContain("attendance.filters.date");
  });
});
