import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetAddModal } from "./BudgetAddModal";

/**
 * Regression: the native `<form onSubmit>` (Enter) used to call the raw parent
 * `onSave` instead of the footer's guarded handler, so a rejected save produced
 * an unhandled rejection and the destructive banner was never rendered. Both
 * entry points must share one awaited path: the error surfaces in the banner and
 * the modal stays open.
 */

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const classes = [{ id: "cls-1", name: "Grade 1" }] as never[];

function findFooterSave(): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "common.save",
  );
  if (!button) throw new Error("footer save button not found");
  return button as HTMLButtonElement;
}

describe("BudgetAddModal save failure", () => {
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

  async function render(onSave: () => Promise<void>, onClose = vi.fn()) {
    await act(async () => {
      root.render(
        <BudgetAddModal
          open
          onClose={onClose}
          budgetType="income"
          classes={classes}
          targetClassId="cls-1"
          onTargetClassIdChange={vi.fn()}
          detail="Monthly donation"
          onDetailChange={vi.fn()}
          amount="100"
          onAmountChange={vi.fn()}
          currencyLabel="PKR"
          saving={false}
          onSave={onSave}
        />,
      );
    });
    return onClose;
  }

  const rejectingSave = () => vi.fn().mockRejectedValue(new Error("budget save failed"));

  it("shows the banner and keeps the modal open when the footer save rejects", async () => {
    const onSave = rejectingSave();
    const onClose = await render(onSave);

    await act(async () => {
      findFooterSave().click();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("budget save failed");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("budget save failed");
    expect(onClose).not.toHaveBeenCalled();
    // Still mounted and interactive: the user can retry instead of losing the draft.
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(findFooterSave().disabled).toBe(false);
  });

  it("shows the banner for the native form onSubmit (Enter) path too", async () => {
    const onSave = rejectingSave();
    const onClose = await render(onSave);

    const form = document.querySelector("form#budget-add-form");
    expect(form).not.toBeNull();
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("budget save failed");
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
