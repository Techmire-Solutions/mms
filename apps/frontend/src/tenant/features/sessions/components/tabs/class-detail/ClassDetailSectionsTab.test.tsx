import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionClassSection } from "@mms/shared";
import { ClassDetailSectionsTab } from "./ClassDetailSectionsTab";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/useAcademicTerms", () => ({
  useAcademicTerms: () => ({
    session: { singular: "Session", plural: "Sessions" },
    class: { singular: "Class", plural: "Classes" },
    section: { singular: "Section", plural: "Sections" },
  }),
}));
vi.mock("../SectionStaffModal", () => ({
  SectionStaffModal: () => <div data-testid="staff-modal" />,
}));

const sections: SessionClassSection[] = [
  {
    id: "s-a",
    name: "A",
    capacity: 20,
    room: "",
    status: "active",
    enrolled: 3,
    classTeacherName: "Teacher A",
  },
  { id: "s-b", name: "B", capacity: 20, room: "", status: "active", enrolled: 0 },
];

describe("ClassDetailSectionsTab", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onChange = vi.fn();

  const render = (savedIds: string[]) =>
    act(async () => {
      root.render(
        <ClassDetailSectionsTab
          classId="cls-1"
          sections={sections}
          savedSectionIds={new Set(savedIds)}
          allFaculty={[]}
          onChange={onChange}
        />,
      );
    });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onChange.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("given sections A and B, should add section C when the add control is clicked", async () => {
    // Arrange
    await render(["s-a", "s-b"]);
    const addButton = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("academicCatalog.add"),
    );

    // Act
    await act(async () => {
      addButton?.click();
    });

    // Assert
    const next = onChange.mock.calls[0]?.[0] as SessionClassSection[];
    expect(next.map((s) => s.name)).toEqual(["A", "B", "C"]);
    expect(next[2]).toMatchObject({ classId: "cls-1", capacity: 30, status: "active" });
  });

  it("given an unsaved section, should disable its staff button and show the current class teacher of saved ones", async () => {
    // Arrange / Act
    await render(["s-a"]);

    // Assert
    const staffButtons = Array.from(document.querySelectorAll("button")).filter((b) =>
      b.textContent?.includes("sessions.sections.manageStaff"),
    );
    expect(staffButtons).toHaveLength(2);
    expect(staffButtons[0]).toBeInstanceOf(HTMLButtonElement);
    expect((staffButtons[0] as HTMLButtonElement).disabled).toBe(false);
    expect((staffButtons[1] as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).toContain("Teacher A");
  });
});
