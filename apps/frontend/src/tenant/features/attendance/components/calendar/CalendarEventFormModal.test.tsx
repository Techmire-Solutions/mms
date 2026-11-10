import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarEventFormModal } from "./CalendarEventFormModal";

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
  useSessionsCollection: () => [],
}));

describe("CalendarEventFormModal", () => {
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

  function saveButton(): HTMLButtonElement {
    const button = [...document.querySelectorAll("button")].find((candidate) =>
      candidate.textContent?.includes("common.save"),
    );
    if (!button) throw new Error("save button not found");
    return button as HTMLButtonElement;
  }

  it("validates with the shared calendar schema and keeps the modal open on failure", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    await act(async () => {
      root.render(
        <CalendarEventFormModal
          open={true}
          entry={null}
          isPending={false}
          onClose={vi.fn()}
          onSave={onSave}
        />,
      );
    });

    await act(async () => saveButton().click());

    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Title is required");
  });
});
