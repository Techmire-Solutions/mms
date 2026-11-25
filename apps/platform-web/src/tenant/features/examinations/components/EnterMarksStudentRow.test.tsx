import React from "react";
import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { EnterMarksStudentRow } from "./EnterMarksStudentRow";
import type { Exam } from "@/lib/data/examinationData";
import type { Student } from "@/lib/data/studentsData";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("EnterMarksStudentRow", () => {
  const mockStudent: Student & { classId: string; rollNo: string } = {
    id: "std-1",
    contactId: "c-1",
    name: "Zayd Ali",
    grNumber: "GR-101",
    classId: "cls-1",
    rollNo: "GR-101",
    status: "active",
    enrollmentDate: "2024-01-01",
    guardians: [],
  };

  const mockExam: Exam = {
    id: "exam-1",
    name: "Midterm Quranic Studies",
    subject: "Quran",
    date: "2024-05-15",
    duration: 60,
    description: "Midterm Quranic Studies Exam",
    totalMarks: 100,
    passingMarks: 50,
    classIds: ["cls-1"],
    status: "ongoing",
  };

  it("renders student information and marks input with inputMode='decimal'", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onMarkChange = vi.fn();

    await act(async () => {
      root.render(
        <EnterMarksStudentRow
          student={mockStudent}
          index={0}
          exam={mockExam}
          classNameText="Hifz Class A"
          markValue="85"
          onMarkChange={onMarkChange}
        />,
      );
    });

    expect(container.textContent).toContain("Zayd Ali");
    expect(container.textContent).toContain("Hifz Class A");
    expect(container.textContent).toContain("GR-101");

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.getAttribute("inputmode")).toBe("decimal");
    expect(input.value).toBe("85");
  });

  it("calculates and displays percentage and grade badge", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <EnterMarksStudentRow
          student={mockStudent}
          index={0}
          exam={mockExam}
          classNameText="Hifz Class A"
          markValue="95"
          onMarkChange={vi.fn()}
        />,
      );
    });

    // 95 / 100 = 95%
    expect(container.textContent).toContain("95%");
  });

  it("calls onMarkChange when mark input changes", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onMarkChange = vi.fn();

    await act(async () => {
      root.render(
        <EnterMarksStudentRow
          student={mockStudent}
          index={0}
          exam={mockExam}
          classNameText="Hifz Class A"
          markValue=""
          onMarkChange={onMarkChange}
        />,
      );
    });

    const input = container.querySelector("input") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "88");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onMarkChange).toHaveBeenCalledWith("std-1", "88");
  });
});
