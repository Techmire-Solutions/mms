import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression: the save path awaited the parent `onSave` without a synchronous
 * in-flight guard. `submitting` disables the footer only after a re-render, so a
 * same-frame double submit created two fiscal years (each with its own client id).
 * `AccountingFiscalYearModal` must route every submit through `useSubmitGuard`.
 */

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@mms/fe-core/components/FormModal", () => ({
  FormModal: ({
    children,
    onSave,
  }: {
    children: React.ReactNode;
    onSave?: () => Promise<void> | void;
  }) => (
    <div>
      {children}
      <button
        type="button"
        data-testid="fy-save"
        onClick={() => {
          void onSave?.();
        }}
      >
        save
      </button>
    </div>
  ),
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

vi.mock("@mms/fe-core/components/FormSelect", () => ({
  FormSelect: ({
    id,
    value,
    onChange,
    options,
  }: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

import { AccountingFiscalYearModal } from "./AccountingFiscalYearModal";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("AccountingFiscalYearModal save guard", () => {
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

  it("collapses two synchronous saves into one onSave", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      root.render(
        <AccountingFiscalYearModal
          open
          initial={{
            id: "fy-1",
            label: "2026",
            startDate: "2026-01-01",
            endDate: "2026-12-31",
            status: "active",
          }}
          onSave={onSave}
          onClose={vi.fn()}
        />,
      );
    });

    const save = container.querySelector<HTMLButtonElement>('[data-testid="fy-save"]');
    expect(save).not.toBeNull();

    await act(async () => {
      save?.click();
      save?.click();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: "fy-1", label: "2026", status: "active" }),
    );
  });
});
