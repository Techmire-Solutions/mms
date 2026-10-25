import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Faculty } from "@mms/shared";
import { FacultyWorkloadPill } from "./FacultyWorkloadPill";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        "faculty.workload.available": "Available",
        "faculty.workload.moderate": "Active Load",
        "faculty.workload.heavy": "Heavy Load",
        "faculty.leave.onLeave": "On Leave",
        "faculty.status.inactive": "Inactive",
      };
      return dict[key] ?? key;
    },
  }),
}));

const baseFaculty: Faculty = {
  id: "fac-1",
  contactId: "cnt-1",
  status: "active",
};

describe("FacultyWorkloadPill", () => {
  it("renders Available pill for active faculty with 0 classes", () => {
    const html = renderToStaticMarkup(<FacultyWorkloadPill faculty={baseFaculty} />);
    expect(html).toContain("Available");
    expect(html).toContain("bg-info");
  });

  it("renders Active Load pill with count for faculty with 2 classes", () => {
    const html = renderToStaticMarkup(
      <FacultyWorkloadPill faculty={{ ...baseFaculty, assignedClasses: ["cls-1", "cls-2"] }} />,
    );
    expect(html).toContain("Active Load");
    expect(html).toContain("2");
    expect(html).toContain("bg-success");
  });

  it("renders Heavy Load pill for faculty with 3 or more classes", () => {
    const html = renderToStaticMarkup(
      <FacultyWorkloadPill
        faculty={{ ...baseFaculty, assignedClasses: ["cls-1", "cls-2", "cls-3"] }}
      />,
    );
    expect(html).toContain("Heavy Load");
    expect(html).toContain("3");
    expect(html).toContain("bg-warning");
  });

  it("renders On Leave pill when faculty is on leave", () => {
    const html = renderToStaticMarkup(
      <FacultyWorkloadPill
        faculty={{
          ...baseFaculty,
          assignedClasses: ["cls-1"],
          leaveDetails: { isOnLeave: true },
        }}
      />,
    );
    expect(html).toContain("On Leave");
    expect(html).toContain("bg-warning");
  });

  it("renders Inactive pill when faculty status is inactive", () => {
    const html = renderToStaticMarkup(
      <FacultyWorkloadPill faculty={{ ...baseFaculty, status: "inactive" }} />,
    );
    expect(html).toContain("Inactive");
    expect(html).toContain("bg-muted-foreground/60");
  });
});
