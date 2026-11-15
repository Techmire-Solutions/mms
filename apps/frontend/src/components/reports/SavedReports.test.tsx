import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenericSavedReport, GenericSavedReportCreateInput } from "@mms/shared";
import SavedReports from "./SavedReports";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("SavedReports", () => {
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
    document.body.innerHTML = "";
  });

  function source(createReport: (input: GenericSavedReportCreateInput) => Promise<void>) {
    return {
      reports: [] as GenericSavedReport[],
      isLoading: false,
      isError: false,
      retry: vi.fn(),
      createReport,
      deleteReport: vi.fn(),
      runReport: vi.fn(),
    };
  }

  it("shows a schema error for an overlong report name and does not create", async () => {
    const createReport = vi.fn();
    await act(async () => {
      root.render(
        <SavedReports
          category="students"
          source={source(createReport)}
          filters={{}}
          onApplyFilters={vi.fn()}
        />,
      );
    });

    const open = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "reports.saved.saveCurrent",
    );
    await act(async () => open?.click());
    const input = document.body.querySelector("#saved-report-name") as HTMLInputElement;
    await act(async () => setInputValue(input, "x".repeat(201)));

    const save = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "reports.saved.save",
    );
    await act(async () => save?.click());

    expect(createReport).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("validation.invalid");
  });

  it("resets the name and closes the dialog after a successful create", async () => {
    const createReport = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      root.render(
        <SavedReports
          category="students"
          source={source(createReport)}
          filters={{}}
          onApplyFilters={vi.fn()}
        />,
      );
    });

    const open = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "reports.saved.saveCurrent",
    );
    await act(async () => open?.click());
    await act(async () =>
      setInputValue(
        document.body.querySelector("#saved-report-name") as HTMLInputElement,
        "My report",
      ),
    );
    const save = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "reports.saved.save",
    );
    await act(async () => save?.click());

    expect(createReport).toHaveBeenCalledWith(
      expect.objectContaining({ name: "My report", category: "students" }),
    );
    expect(document.body.querySelector("#saved-report-name")).toBeNull();
  });
});
