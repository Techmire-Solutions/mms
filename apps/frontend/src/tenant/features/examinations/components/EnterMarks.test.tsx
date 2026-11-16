import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) };
});
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { EnterMarks } from "./EnterMarks";
import type { Exam, ExamResult } from "@/lib/data/examinationData";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
      name: "Session 2025",
      classes: [
        {
          id: "cls-1",
          name: "Grade 1",
          sections: [
            { id: "sec-1", name: "A", enrolled: 0, capacity: 30 },
            { id: "sec-2", name: "B", enrolled: 0, capacity: 30 },
          ],
        },
      ],
    },
  ],
}));

vi.mock("@/tenant/hooks/collections/enrollments", () => ({
  useEnrollmentsCollection: () => [
    {
      id: "enr-1",
      studentId: "std-1",
      classId: "cls-1",
      sectionId: "sec-1",
      sessionId: "ses-1",
      status: "active",
      enrollmentDate: "2025-01-01",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
    {
      id: "enr-2",
      studentId: "std-2",
      classId: "cls-1",
      sectionId: "sec-2",
      sessionId: "ses-1",
      status: "active",
      enrollmentDate: "2025-01-01",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
  ],
}));

vi.mock("@/tenant/hooks/collections/students", () => ({
  useStudentsByIds: () => ({
    data: [
      {
        id: "std-1",
        name: "Ali Raza",
        grNumber: "GR-100",
      },
      {
        id: "std-2",
        name: "Sara Khan",
        grNumber: "GR-101",
      },
    ],
  }),
}));

vi.mock("@/components/common/SectionFilterField", () => ({
  SectionFilterField: ({
    sections,
    value,
    onChange,
  }: {
    sections: Array<{ id: string; name: string }>;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <select
      data-testid="section-filter"
      aria-label="section"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">all</option>
      {sections.map((section) => (
        <option key={section.id} value={section.id}>
          {section.name}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/components/app/UserAvatar", () => ({
  UserAvatar: ({ name }: { name?: React.ReactNode }) => <div data-testid="avatar">{name}</div>,
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

const mockResults: ExamResult[] = [
  {
    id: "er_ex-1_std-1",
    examId: "ex-1",
    studentId: "std-1",
    marksObtained: 85,
    version: 3,
  },
];

function findSaveButton(container: HTMLElement): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("examinations.enterMarks.save"),
  );
}

describe("EnterMarks Component", () => {
  it("renders exam radio selection and students marks inputs", () => {
    const html = renderToStaticMarkup(
      <EnterMarks exams={[mockExam]} results={mockResults} onSaveResults={vi.fn()} />,
    );

    expect(html).toContain("Tajweed Test");
    expect(html).toContain("Ali Raza");
    expect(html).toContain("examinations.enterMarks.save");
  });

  it("echoes the stored id and OCC version so a concurrent save cannot overwrite silently", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onSaveResults = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <EnterMarks exams={[mockExam]} results={mockResults} onSaveResults={onSaveResults} />,
      );
    });

    // The save action is dirty-gated: make an edit before saving.
    const input = container.querySelector("input[name='marks_std-1']") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "90");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const saveButton = findSaveButton(container);
    expect(saveButton).toBeDefined();

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSaveResults).toHaveBeenCalledTimes(1);
    const [, savedResults] = onSaveResults.mock.calls[0] as [string, ExamResult[]];
    expect(savedResults).toHaveLength(1);
    expect(savedResults[0]).toMatchObject({
      id: "er_ex-1_std-1",
      examId: "ex-1",
      studentId: "std-1",
      marksObtained: 90,
      version: 3,
    });
  });

  it("keeps the draft when a background results refetch arrives while dirty", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onSaveResults = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <EnterMarks exams={[mockExam]} results={mockResults} onSaveResults={onSaveResults} />,
      );
    });

    const input = container.querySelector("input[name='marks_std-1']") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "90");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // Another client's save/moderation changes the persisted rows while the draft is dirty.
    await act(async () => {
      root.render(
        <EnterMarks
          exams={[mockExam]}
          results={[{ ...mockResults[0]!, marksObtained: 70 }]}
          onSaveResults={onSaveResults}
        />,
      );
    });

    expect((container.querySelector("input[name='marks_std-1']") as HTMLInputElement).value).toBe(
      "90",
    );
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("locks the grid and the save action once results are published", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onSaveResults = vi.fn();

    await act(async () => {
      root.render(
        <EnterMarks
          exams={[
            { ...mockExam, status: "completed", resultsFinalizedAt: "2026-03-01T00:00:00.000Z" },
          ]}
          results={mockResults}
          onSaveResults={onSaveResults}
        />,
      );
    });

    expect(container.textContent).toContain("examinations.enterMarks.lockedTitle");
    const input = container.querySelector("input[name='marks_std-1']") as HTMLInputElement | null;
    expect(input?.disabled).toBe(true);
    expect(findSaveButton(container)?.disabled).toBe(true);
  });

  it("keeps marks and the section filter when the same exam arrives as a new object", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onSaveResults = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <EnterMarks exams={[mockExam]} results={mockResults} onSaveResults={onSaveResults} />,
      );
    });

    const sectionFilter = container.querySelector<HTMLSelectElement>(
      '[data-testid="section-filter"]',
    );
    await act(async () => {
      if (sectionFilter) {
        sectionFilter.value = "sec-1";
        sectionFilter.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    const input = container.querySelector("input[name='marks_std-1']") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "90");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // A background refetch hands over a fresh exam object with the SAME id — identity is
    // the id, not the object reference, so the draft must survive.
    await act(async () => {
      root.render(
        <EnterMarks
          exams={[{ ...mockExam }]}
          results={mockResults}
          onSaveResults={onSaveResults}
        />,
      );
    });

    expect((container.querySelector("input[name='marks_std-1']") as HTMLInputElement).value).toBe(
      "90",
    );
    expect(
      container.querySelector<HTMLSelectElement>('[data-testid="section-filter"]')?.value,
    ).toBe("sec-1");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("re-seeds marks and clears the section filter for a different exam id", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onSaveResults = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <EnterMarks exams={[mockExam]} results={mockResults} onSaveResults={onSaveResults} />,
      );
    });

    const sectionFilter = container.querySelector<HTMLSelectElement>(
      '[data-testid="section-filter"]',
    );
    await act(async () => {
      if (sectionFilter) {
        sectionFilter.value = "sec-1";
        sectionFilter.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    const input = container.querySelector("input[name='marks_std-1']") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "90");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const otherExam: Exam = { ...mockExam, id: "ex-2", name: "Second Test" };
    const otherResults: ExamResult[] = [{ ...mockResults[0]!, examId: "ex-2", marksObtained: 70 }];
    const confirmMock = vi.fn(() => true);
    (window as unknown as { confirm: typeof confirmMock }).confirm = confirmMock;
    await act(async () => {
      root.render(
        <EnterMarks
          exams={[mockExam, otherExam]}
          results={[...mockResults, ...otherResults]}
          onSaveResults={onSaveResults}
        />,
      );
    });
    const otherExamButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Second Test",
    );
    await act(async () => {
      otherExamButton?.click();
    });
    expect(confirmMock).toHaveBeenCalledTimes(1);

    expect((container.querySelector("input[name='marks_std-1']") as HTMLInputElement).value).toBe(
      "70",
    );
    expect(
      container.querySelector<HTMLSelectElement>('[data-testid="section-filter"]')?.value,
    ).toBe("");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
