import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceFilters, type AttendanceFilterState } from "./AttendanceFilters";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("framer-motion", () => {
  const comp = ({ children, ...props }: { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  );
  return {
    m: new Proxy({}, { get: () => comp }),
    motion: { div: comp },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

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

  it("keeps the clear action outside the collapsible toggle (axe nested-interactive)", () => {
    // A non-today date makes `activeCount > 0`, so the Clear button renders.
    const html = renderToStaticMarkup(
      <AttendanceFilters
        filters={{
          sessionId: "",
          classId: "",
          facultyId: "",
          date: "2024-01-01",
        }}
        onChange={vi.fn()}
      />,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const toggle = doc.querySelector('[aria-controls="filters-panel"]');
    expect(toggle).not.toBeNull();

    const clearButton = Array.from(doc.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("attendance.filters.clear"),
    );
    expect(clearButton).toBeDefined();
    // Interactive controls must not be nested inside another interactive control.
    expect(
      toggle!.querySelector("button, a[href], input, select, textarea, [role='button']"),
    ).toBeNull();
  });

  describe("collapsible header", () => {
    let container: HTMLDivElement;
    let root: Root;

    function mount(onChange: (filters: AttendanceFilterState) => void): HTMLElement {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      act(() => {
        root.render(
          <AttendanceFilters
            filters={{ sessionId: "", classId: "", facultyId: "", date: "2024-01-01" }}
            onChange={onChange}
          />,
        );
      });
      const toggle = container.querySelector<HTMLElement>('[aria-controls="filters-panel"]');
      expect(toggle).not.toBeNull();
      return toggle!;
    }

    function pressKey(element: HTMLElement, key: string): void {
      act(() => {
        element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      });
    }

    afterEach(() => {
      act(() => root.unmount());
      container.remove();
    });

    it("collapses and expands on click and on Enter/Space, ignoring other keys", () => {
      const toggle = mount(vi.fn());
      expect(toggle.getAttribute("aria-expanded")).toBe("true");

      act(() => toggle.click());
      expect(toggle.getAttribute("aria-expanded")).toBe("false");

      pressKey(toggle, "Enter");
      expect(toggle.getAttribute("aria-expanded")).toBe("true");

      pressKey(toggle, " ");
      expect(toggle.getAttribute("aria-expanded")).toBe("false");

      pressKey(toggle, "a");
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
    });

    it("clears every filter back to the workspace default day", () => {
      const onChange = vi.fn();
      mount(onChange);

      const clearButton = Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("attendance.filters.clear"),
      );
      expect(clearButton).toBeDefined();
      act(() => clearButton!.click());

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: "", classId: "", facultyId: "" }),
      );
      expect(onChange.mock.calls[0]![0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
