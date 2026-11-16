import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";

/**
 * Regression 1: the row Delete button fired `handleDeleteDist` immediately. A
 * distribution delete is irreversible, so it must open the confirmation first and
 * only call the handler from `onConfirm`; cancelling must not delete.
 *
 * Regression 2: `persistWidgetHasanatDistributionDelete` used `apiFetch`, which
 * resolves on 4xx/5xx, so a rejected delete looked successful (the row stayed and
 * no error surfaced). It must go through `apiJson`, which throws on non-2xx.
 */

const mocks = vi.hoisted(() => ({ apiJson: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({ apiJson: mocks.apiJson }));

import { WidgetDrilldownModalRecords } from "./WidgetDrilldownModalRecords";
import { persistWidgetHasanatDistributionDelete } from "@/lib/reports/widgetRecordToggle";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const widget = {
  id: "w-hasanat",
  title: "Hasanat distributions",
  category: "hasanat",
  collection: "hasanat_distributions",
} as unknown as CustomWidget;

const records = [
  {
    id: "dist-1",
    studentId: "std-1",
    denominationName: "Gold coin",
    quantity: 2,
    status: "active",
  },
];

function buttonByText(scope: ParentNode, text: string): HTMLButtonElement {
  const button = [...scope.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!button) throw new Error(`button not found: ${text}`);
  return button as HTMLButtonElement;
}

describe("WidgetDrilldownModalRecords delete confirmation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.apiJson.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  async function render(handleDeleteDist = vi.fn()) {
    await act(async () => {
      root.render(
        <WidgetDrilldownModalRecords
          t={((key: string) => key) as never}
          widget={widget}
          paginatedItems={records as never[]}
          studentNameMap={new Map([["std-1", "Ali Raza"]])}
          handleToggleStatus={vi.fn()}
          handleDeleteDist={handleDeleteDist}
        />,
      );
    });
    return handleDeleteDist;
  }

  it("opens the confirm first, only deletes from onConfirm, and cancels safely", async () => {
    const handleDeleteDist = await render();

    await act(async () => {
      buttonByText(container, "reports.widgets.delete").click();
    });
    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(handleDeleteDist).not.toHaveBeenCalled();

    // Cancel keeps the row and does not delete.
    await act(async () => {
      buttonByText(dialog as HTMLElement, "common.cancel").click();
    });
    expect(handleDeleteDist).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();

    // Confirming invokes the handler with the pending record id.
    await act(async () => {
      buttonByText(container, "reports.widgets.delete").click();
    });
    await act(async () => {
      buttonByText(
        document.querySelector('[role="alertdialog"]') as HTMLElement,
        "common.delete",
      ).click();
    });
    expect(handleDeleteDist).toHaveBeenCalledTimes(1);
    expect(handleDeleteDist).toHaveBeenCalledWith("dist-1");
  });
});

describe("persistWidgetHasanatDistributionDelete", () => {
  it("propagates a rejected DELETE instead of reporting success", async () => {
    mocks.apiJson.mockRejectedValue(new Error("distribution not found"));

    await expect(persistWidgetHasanatDistributionDelete("dist-404")).rejects.toThrow(
      "distribution not found",
    );
    expect(mocks.apiJson).toHaveBeenCalledWith(expect.stringContaining("/distributions/dist-404"), {
      method: "DELETE",
    });
  });
});
