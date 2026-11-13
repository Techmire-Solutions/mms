import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { EnterMarksTable } from "./EnterMarksTable";
import type { Exam } from "@/lib/data/examinationData";
import type { ExamStudent } from "../hooks/useEnterMarksStudents";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const exam: Exam = {
  id: "ex-1",
  name: "Midterm",
  subject: "Quran",
  date: "2026-03-10",
  duration: 60,
  totalMarks: 100,
  passingMarks: 50,
  classIds: ["c-1"],
  status: "ongoing",
  description: "",
};

const student = (id: string, name: string): ExamStudent =>
  ({ id, name, classId: "c-1", sectionId: "sec-1", rollNo: id, grNumber: id }) as ExamStudent;

describe("EnterMarksTable keyboard navigation", () => {
  async function renderTable() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <EnterMarksTable
          exam={exam}
          students={[student("std-1", "Ali"), student("std-2", "Sara")]}
          classNamesById={new Map([["c-1", "Class 1"]])}
          marks={{}}
          onMarkChange={vi.fn()}
        />,
      );
    });
    return { container, root };
  }

  it("moves focus down/up between student rows with ArrowDown/ArrowUp", async () => {
    const { container, root } = await renderTable();
    const first = container.querySelector("#marks-std-1") as HTMLInputElement;
    const second = container.querySelector("#marks-std-2") as HTMLInputElement;
    await act(async () => {
      first.focus();
      first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    expect(document.activeElement).toBe(second);
    await act(async () => {
      second.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    });
    expect(document.activeElement).toBe(first);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
