import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useExaminationForm } from "./useExaminationForm";
import type { Exam } from "@/lib/data/examinationData";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessionsCollection: () => [
    {
      id: "ses-1",
      name: "Session 2025",
      classes: [{ id: "cls-1", name: "Grade 1" }],
    },
  ],
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockExam: Exam = {
  id: "ex-1",
  name: "Tajweed Test",
  subject: "Tajweed",
  date: "2025-01-01",
  duration: 60,
  totalMarks: 100,
  passingMarks: 50,
  classIds: ["cls-1"],
  status: "upcoming",
  description: "",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

describe("useExaminationForm Hook", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    return () => {
      if (container) {
        container.remove();
        container = null;
      }
    };
  });

  it("initializes draft with existing exam and parses classes", async () => {
    let hookResult: any;

    function TestComponent() {
      hookResult = useExaminationForm({
        open: true,
        exam: mockExam,
        onClose: vi.fn(),
        onSave: vi.fn(),
      });
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult.examDraft.name).toBe("Tajweed Test");
    expect(hookResult.classes).toEqual([{ id: "cls-1", name: "Session 2025 - Grade 1" }]);
    expect(hookResult.valid).toBe(true);
  });

  it("validates empty draft and clears error on field update", async () => {
    let hookResult: any;

    function TestComponent() {
      hookResult = useExaminationForm({
        open: true,
        exam: null,
        onClose: vi.fn(),
        onSave: vi.fn(),
      });
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    // Attempt save on empty draft
    await act(async () => {
      await hookResult.handleSave();
    });

    expect(hookResult.errors.name).toBe("examinations.form.validation.nameRequired");
    expect(hookResult.submitError).toBe("examinations.form.validation.nameRequired");

    // Updating draft field clears error
    await act(async () => {
      hookResult.updateDraft({ name: "Midterm Exam" });
    });

    expect(hookResult.errors.name).toBeUndefined();
    expect(hookResult.submitError).toBe("examinations.form.validation.dateRequired");

    // Updating remaining required fields clears all errors and submitError
    await act(async () => {
      hookResult.updateDraft({ date: "2025-05-01", classIds: ["cls-1"] });
    });

    expect(hookResult.errors.date).toBeUndefined();
    expect(hookResult.errors.classes).toBeUndefined();
    expect(hookResult.submitError).toBeUndefined();
  });
});
