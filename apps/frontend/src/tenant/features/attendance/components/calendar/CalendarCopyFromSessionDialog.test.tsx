import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarCopyFromSessionDialog } from "./CalendarCopyFromSessionDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/useAcademicTerms", () => ({
  useAcademicTerms: () => ({
    session: { singular: "Session" },
    class: { singular: "Class" },
    section: { singular: "Section" },
  }),
}));
vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessionsCollection: () => [
    { id: "s1", name: "2025-26", startDate: "2025-04-01", endDate: "2025-09-30" },
    { id: "s2", name: "2026-27", startDate: "2026-04-01", endDate: "2026-09-30" },
  ],
}));
vi.mock("@/tenant/features/attendance/hooks/useAcademicCalendar", () => ({
  useAcademicCalendarEvents: () => ({ data: [], isPending: false, isFetching: false }),
}));

describe("CalendarCopyFromSessionDialog dirty guard", () => {
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

  async function renderDialog(onClose: () => void): Promise<void> {
    await act(async () => {
      root.render(
        <CalendarCopyFromSessionDialog
          open
          isPending={false}
          onClose={onClose}
          onCopy={vi.fn().mockResolvedValue(true)}
        />,
      );
    });
  }

  async function selectSource(sessionId: string): Promise<void> {
    const select = document.querySelector("#calendar-copy-source") as HTMLSelectElement;
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setValue?.call(select, sessionId);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("asks to discard before closing a dialog with a chosen source session", async () => {
    const onClose = vi.fn();
    await renderDialog(onClose);
    await selectSource("s1");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("settings.unsavedChanges");
    expect(document.body.textContent).toContain("common.discardUnsavedDescription");

    const discard = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "common.yes",
    );
    await act(async () => discard?.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes a pristine dialog without asking", async () => {
    const onClose = vi.fn();
    await renderDialog(onClose);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("settings.unsavedChanges");
  });
});
