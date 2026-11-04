/**
 * Faculty drawer — assignment history section.
 *
 * A failed assignments fetch must render an error, not a synthetic "primary"
 * appointment built from the faculty row (the server never returned it).
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useFacultyAssignments: vi.fn(),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../hooks/useFacultyAssignments", () => ({
  useFacultyAssignments: (...args: unknown[]) => mocks.useFacultyAssignments(...args),
}));

import { FacultyDetailAssignmentsSection } from "./FacultyDetailAssignmentsSection";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("FacultyDetailAssignmentsSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render() {
    act(() => {
      root.render(
        <FacultyDetailAssignmentsSection
          facultyId="f1"
          primaryDesignation="Mudarris"
          primaryDepartment="Hifz"
        />,
      );
    });
    return container.textContent ?? "";
  }

  it("shows a load error instead of fabricating an appointment", () => {
    mocks.useFacultyAssignments.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    const text = render();

    expect(text).toContain("faculty.errors.loadAssignments");
    expect(text).not.toContain("Mudarris");
    expect(text).not.toContain("Hifz");
  });

  it("uses the faculty row as a clearly derived fallback when the fetch succeeds empty", () => {
    mocks.useFacultyAssignments.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const text = render();

    expect(text).toContain("Mudarris");
    expect(text).toContain("Hifz");
    expect(text).toContain("faculty.assignments.derivedFromProfile");
  });
});
