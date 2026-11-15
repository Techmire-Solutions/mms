import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DistributionFormModal } from "./DistributionFormModal";

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({
    children,
    onSave,
    error,
  }: {
    children: React.ReactNode;
    onSave?: () => void;
    error?: string;
  }) => (
    <div>
      {error ? <div role="alert">{error}</div> : null}
      {children}
      <button type="button" onClick={() => onSave?.()}>
        save
      </button>
    </div>
  ),
}));

vi.mock("@/tenant/features/obligations/hooks/useDistributionAccountOptions", () => ({
  useDistributionAccountOptions: () => [],
}));

describe("DistributionFormModal validation", () => {
  it("surfaces the percentage error instead of silently disabling Save at 0%", async () => {
    const onSave = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DistributionFormModal
          title="Distribution"
          initial={{ name: "Share", percentage: 0, type: "Income" }}
          onSave={onSave}
          onClose={vi.fn()}
        />,
      );
    });

    const save = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "save",
    );
    await act(async () => {
      save?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(container.textContent).toContain("obligations.wakala.pctInvalid");

    await act(async () => root.unmount());
    container.remove();
  });
});
