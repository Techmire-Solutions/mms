import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentsBulkEnrollModal } from "./StudentsBulkEnrollModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count) return `Enrolling ${params.count} students`;
      return key;
    },
  }),
}));

vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessions: () => ({ isLoading: false }),
  useSessionsCollection: () => [
    {
      id: "ses-1",
      name: "Morning Hifz",
      type: "academic",
      status: "open",
      classes: [{ id: "cls-1", name: "Darja 1", sections: [] }],
    },
    { id: "ses-2", name: "Evening Tajweed", type: "short_course", status: "open", classes: [] },
    { id: "ses-3", name: "Archived Session", type: "academic", status: "archived", classes: [] },
  ],
}));

vi.mock("@/hooks/useAcademicTerms", () => ({
  useAcademicTerms: () => ({
    session: { singular: "Session", plural: "Sessions" },
    class: { singular: "Class", plural: "Classes" },
    section: { singular: "Section", plural: "Sections" },
  }),
}));

vi.mock("@mms/fe-core/components/FormPrimitives", () => ({
  Field: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  FormSelect: ({
    id,
    value,
    onChange,
    options,
  }: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="" />
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@mms/fe-core/components/FormModal", () => ({
  FormModal: ({
    title,
    children,
    error,
    onSave,
  }: {
    title: string;
    children: React.ReactNode;
    error?: string;
    onSave: () => void;
  }) => (
    <div data-testid="modal">
      <h1>{title}</h1>
      {error ? <div role="alert">{error}</div> : null}
      <div>{children}</div>
      <button type="button" onClick={onSave}>
        save
      </button>
    </div>
  ),
}));

describe("StudentsBulkEnrollModal Component", () => {
  it("given open, should render the session picker, class field and enroll/cancel modes", () => {
    const html = renderToStaticMarkup(
      <StudentsBulkEnrollModal
        open={true}
        onClose={vi.fn()}
        selectedCount={5}
        onConfirm={vi.fn()}
      />,
    );

    expect(html).toContain("students.bulkEnrollTitle");
    expect(html).toContain("Enrolling 5 students");
    expect(html).toContain("Morning Hifz");
    expect(html).toContain("Evening Tajweed");
    expect(html).not.toContain("Archived Session");
    expect(html).toContain("students.bulkEnrollModeEnroll");
    expect(html).toContain("students.bulkEnrollModeCancel");
    expect(html).toContain("bulk-enroll-class");
  });

  it("returns null when open is false", () => {
    const htmlClosed = renderToStaticMarkup(
      <StudentsBulkEnrollModal
        open={false}
        onClose={vi.fn()}
        selectedCount={0}
        onConfirm={vi.fn()}
      />,
    );

    expect(htmlClosed).toBe("");
  });

  describe("when the parent reports a failed enroll", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(async () => {
      await act(async () => root.unmount());
      container.remove();
    });

    function select(id: string, value: string): void {
      const element = container.querySelector(`#${id}`);
      if (!(element instanceof HTMLSelectElement)) throw new Error(`${id} select missing`);
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
        setter?.call(element, value);
        element.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }

    it("shows the banner and keeps the placement inputs for retry", async () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn().mockResolvedValue(false);

      act(() =>
        root.render(
          <StudentsBulkEnrollModal
            open={true}
            onClose={onClose}
            selectedCount={2}
            onConfirm={onConfirm}
          />,
        ),
      );

      select("bulk-enroll-session", "ses-1");
      select("bulk-enroll-class", "cls-1");
      const save = container.querySelector("[data-testid='modal'] > button");
      await act(async () => (save as HTMLButtonElement).click());

      expect(onConfirm).toHaveBeenCalledWith({
        mode: "add",
        sessionId: "ses-1",
        classId: "cls-1",
      });
      expect(container.querySelector("[role='alert']")?.textContent).toBe("students.saveFailed");
      expect(onClose).not.toHaveBeenCalled();
      expect((container.querySelector("#bulk-enroll-session") as HTMLSelectElement).value).toBe(
        "ses-1",
      );
      expect((container.querySelector("#bulk-enroll-class") as HTMLSelectElement).value).toBe(
        "cls-1",
      );
    });
  });
});
