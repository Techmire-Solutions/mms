import React, { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { ClassCard } from "./ClassCard";
import { ClassSchema, type FacultyMember } from "@mms/shared";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

const mockClass = ClassSchema.parse({
  id: "cls-1",
  name: "Class 1A",
  room: "Room 101",
  maxStudents: 25,
  enrolled: 20,
  minAge: 6,
  maxAge: 10,
  gender: "mixed",
  facultyId: "t-1",
  facultyName: "Sheikh Ahmad",
  status: "active",
});

const mockFaculty: FacultyMember[] = [
  {
    id: "t-1",
    contactId: "cnt-1",
    employeeId: "EMP-001",
    name: "Sheikh Ahmad",
    email: "ahmad@example.com",
    gender: "male",
    status: "active",
  },
];

describe("ClassCard", () => {
  it("renders class name, room, and capacity meta", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ClassCard
          sessionClass={mockClass}
          faculty={mockFaculty}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          canWrite={true}
        />,
      );
    });

    expect(container.textContent).toContain("Class 1A");
    expect(container.textContent).toContain("Room 101");
    expect(container.textContent).toContain("20/25");
    expect(container.textContent).toContain("Sheikh Ahmad");
  });

  it("triggers onEdit when edit button is clicked", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onEdit = vi.fn();

    await act(async () => {
      root.render(
        <ClassCard
          sessionClass={mockClass}
          faculty={mockFaculty}
          onEdit={onEdit}
          onDelete={vi.fn()}
          canWrite={true}
        />,
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const editBtn = buttons.find((btn) => btn.getAttribute("aria-label")?.includes("editNamed"));
    expect(editBtn).toBeDefined();

    await act(async () => {
      editBtn?.click();
    });

    expect(onEdit).toHaveBeenCalledWith(mockClass);
  });

  it("renders EntityCard.Footer unconditionally when canWrite is false", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ClassCard
          sessionClass={mockClass}
          faculty={mockFaculty}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          canWrite={false}
        />,
      );
    });

    // The footer container with border-t should still exist
    const footer = container.querySelector(".border-t");
    expect(footer).not.toBeNull();

    // Action buttons inside footer should not be rendered
    const editBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.getAttribute("aria-label")?.includes("editNamed"),
    );
    expect(editBtn).toBeUndefined();
  });
});
