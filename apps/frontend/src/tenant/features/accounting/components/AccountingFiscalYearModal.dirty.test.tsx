import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountingFiscalYearModal } from "./AccountingFiscalYearModal";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const harness = vi.hoisted(() => ({
  isDirty: undefined as boolean | undefined,
  discardUnsavedTitle: undefined as string | undefined,
  discardUnsavedDescription: undefined as string | undefined,
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@mms/fe-core/components/FormModal", () => ({
  FormModal: ({
    children,
    isDirty,
    discardUnsavedTitle,
    discardUnsavedDescription,
  }: {
    children: React.ReactNode;
    isDirty?: boolean;
    discardUnsavedTitle?: string;
    discardUnsavedDescription?: string;
  }) => {
    harness.isDirty = isDirty;
    harness.discardUnsavedTitle = discardUnsavedTitle;
    harness.discardUnsavedDescription = discardUnsavedDescription;
    return <div>{children}</div>;
  },
}));

vi.mock("@mms/fe-core/components/DatePicker", () => ({
  DatePicker: ({
    id,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("AccountingFiscalYearModal dirty guard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    harness.isDirty = undefined;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const initial = {
    id: "fy-1",
    label: "2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "active" as const,
  };

  const render = async (record: typeof initial) => {
    await act(async () => {
      root.render(
        <AccountingFiscalYearModal open initial={record} onSave={vi.fn()} onClose={vi.fn()} />,
      );
    });
  };

  it("is clean on open, dirty after an edit, and clean again for a new record", async () => {
    await render(initial);
    expect(harness.isDirty).toBe(false);
    expect(harness.discardUnsavedTitle).toBe("settings.unsavedChanges");
    expect(harness.discardUnsavedDescription).toBe("common.discardUnsavedDescription");

    await act(async () => {
      setInputValue(
        container.querySelector<HTMLInputElement>("#financial-year-label") as HTMLInputElement,
        "2026 revised",
      );
    });
    expect(harness.isDirty).toBe(true);

    // A different record re-baselines the snapshot instead of carrying the edit.
    await render({ ...initial, id: "fy-2", label: "2027" });
    expect(harness.isDirty).toBe(false);
  });
});
