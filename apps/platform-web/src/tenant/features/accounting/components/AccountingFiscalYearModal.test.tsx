import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { AccountingFiscalYearModal } from "./AccountingFiscalYearModal";

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
      <button type="button" data-testid="fy-save" onClick={() => void onSave?.()}>
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

async function renderAndSave(startDate: string, endDate: string) {
  const onSave = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <AccountingFiscalYearModal
        open={true}
        initial={{
          id: "fy-1",
          label: "2026",
          startDate,
          endDate,
          status: "active",
        }}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
  });
  const save = container.querySelector<HTMLButtonElement>('[data-testid="fy-save"]');
  await act(async () => save?.click());
  return { container, onSave, root };
}

describe("AccountingFiscalYearModal dates", () => {
  it("accepts an equal start and end date (shared schema permits it)", async () => {
    const { onSave } = await renderAndSave("2026-01-01", "2026-01-01");
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("rejects an end date before the start date", async () => {
    const { container, onSave } = await renderAndSave("2026-02-01", "2026-01-01");
    expect(onSave).not.toHaveBeenCalled();
    expect(container.textContent).toContain("accounting.settings.fy.validation.endAfterStart");
  });
});
