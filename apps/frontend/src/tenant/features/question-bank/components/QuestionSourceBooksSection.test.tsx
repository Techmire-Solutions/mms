import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModuleFieldDef, QuestionSourceBook } from "@mms/contracts";

/**
 * Regression: the source-book save had no in-flight state and no error handling —
 * the footer stayed enabled while `onSaveBook` was pending, and a rejected save
 * escaped as an unhandled rejection with the modal showing nothing. `savingBook`
 * must disable the footer for the whole request and a rejection must surface in
 * the shared form banner without closing the modal.
 */

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { QuestionSourceBooksSection } from "./QuestionSourceBooksSection";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const draftBook: QuestionSourceBook = {
  id: "book-1",
  name: "Nahw",
  fieldIds: ["sourceBookName"],
  metadata: { bookName: "Nahw" },
} as unknown as QuestionSourceBook;

function findSave(): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes("questionBank.saveSourceBook"),
  );
  if (!button) throw new Error("source book save button not found");
  return button as HTMLButtonElement;
}

describe("QuestionSourceBooksSection save state", () => {
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

  async function render(onSaveBook: () => Promise<void>) {
    const onCloseBookForm = vi.fn();
    await act(async () => {
      root.render(
        <QuestionSourceBooksSection
          sourceBooks={[]}
          availableFieldIds={["sourceBookName"]}
          draftBook={draftBook}
          editingBookId={null}
          showBookForm
          fieldById={new Map<string, ModuleFieldDef>()}
          fieldLabel={(fieldId) => fieldId}
          t={((key: string) => key) as never}
          onStartNew={vi.fn()}
          onStartEdit={vi.fn()}
          onDeleteBook={vi.fn()}
          onToggleBookField={vi.fn()}
          onUpdateBookMeta={vi.fn()}
          onSaveBook={onSaveBook}
          onCloseBookForm={onCloseBookForm}
        />,
      );
    });
    return onCloseBookForm;
  }

  it("disables the footer while onSaveBook is pending", async () => {
    let resolveSave: () => void = () => undefined;
    const onSaveBook = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    await render(onSaveBook);

    await act(async () => {
      findSave().click();
    });
    expect(onSaveBook).toHaveBeenCalledTimes(1);
    expect(findSave().disabled).toBe(true);

    await act(async () => {
      resolveSave();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(findSave().disabled).toBe(false);
  });

  it("renders a rejection in the banner and keeps the modal open", async () => {
    const onSaveBook = vi.fn().mockRejectedValue(new Error("book name already exists"));
    const onCloseBookForm = await render(onSaveBook);

    await act(async () => {
      findSave().click();
    });

    expect(onSaveBook).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "book name already exists",
    );
    // Still open so the user can fix the name instead of losing the draft.
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(onCloseBookForm).not.toHaveBeenCalled();
  });
});
