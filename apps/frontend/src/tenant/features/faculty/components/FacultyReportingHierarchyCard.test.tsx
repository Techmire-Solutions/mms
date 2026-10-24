import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Faculty } from "@mms/shared";
import { FacultyReportingHierarchyCard } from "./FacultyReportingHierarchyCard";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      return key;
    },
  }),
}));

const baseFaculty: Faculty = {
  id: "fac-1",
  contactId: "cnt-1",
  name: "Shaykh Zayd",
  workspaceSubdomain: "tenant",
  status: "active",
};

describe("FacultyReportingHierarchyCard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("returns null when neither supervisor nor subordinates exist", async () => {
    await act(async () => {
      root.render(<FacultyReportingHierarchyCard faculty={baseFaculty} />);
    });
    expect(container.innerHTML).toBe("");
  });

  it("renders supervisor name when reportingFacultyName is present", async () => {
    const facultyWithSupervisor: Faculty = {
      ...baseFaculty,
      reportingFacultyId: "sup-1",
      reportingFacultyName: "Dean Ahmad",
    };

    await act(async () => {
      root.render(<FacultyReportingHierarchyCard faculty={facultyWithSupervisor} />);
    });

    expect(container.textContent).toContain("Dean Ahmad");
    expect(container.textContent).toContain("faculty.field.reportingFacultyId");
  });

  it("renders subordinate count and calls onFilterSubordinates when action clicked", async () => {
    const onFilterSubordinates = vi.fn();
    const facultyWithTeam: Faculty = {
      ...baseFaculty,
      subordinateCount: 5,
    };

    await act(async () => {
      root.render(
        <FacultyReportingHierarchyCard
          faculty={facultyWithTeam}
          onFilterSubordinates={onFilterSubordinates}
        />,
      );
    });

    expect(container.textContent).toContain("faculty.field.subordinateCount");
    expect(container.textContent).toContain("5 faculty.field.subordinates");

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    act(() => {
      button?.click();
    });

    expect(onFilterSubordinates).toHaveBeenCalledWith("fac-1");
  });
});
