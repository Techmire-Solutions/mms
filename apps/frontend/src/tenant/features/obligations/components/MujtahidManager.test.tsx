import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MujtahidManager } from "./MujtahidManager";
import type { Mujtahid, MujtahidRep } from "../lib/mujtahidManagerTypes";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
  }),
}));

vi.mock("@/components/app/ConfirmAlertDialog", () => ({
  ConfirmAlertDialog: ({
    open,
    onConfirm,
    confirmLabel,
  }: {
    open: boolean;
    onConfirm: () => void;
    confirmLabel?: string;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <button type="button" onClick={() => onConfirm()}>
          {confirmLabel ?? "common.delete"}
        </button>
      </div>
    ) : null,
}));

describe("MujtahidManager Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  const sampleMujtahids: Mujtahid[] = [
    { id: "m1", name: "Ayatollah Sistani" },
    { id: "m2", name: "Ayatollah Khamenei" },
  ];

  const sampleReps: MujtahidRep[] = [{ id: "mr1", mujtahid_id: "m1", name: "Representative A" }];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders list of mujtahids and representative counts", async () => {
    await act(async () => {
      root.render(
        <MujtahidManager
          mujtahids={sampleMujtahids}
          reps={sampleReps}
          onChangeMujtahids={vi.fn()}
          onChangeReps={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("Ayatollah Sistani");
    expect(container.textContent).toContain("Ayatollah Khamenei");
  });

  function setInputValue(input: HTMLInputElement, value: string) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    nativeInputValueSetter?.call(input, value);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  it("opens add representative modal and calls onChangeReps on save", async () => {
    const onChangeReps = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <MujtahidManager
          mujtahids={sampleMujtahids}
          reps={sampleReps}
          onChangeMujtahids={vi.fn()}
          onChangeReps={onChangeReps}
        />,
      );
    });

    // Find and click the Add Rep button for Sistani (m1)
    const addRepButtons = Array.from(container.querySelectorAll("button")).filter(
      (btn) =>
        btn.getAttribute("aria-label")?.includes("Ayatollah Sistani") &&
        btn.textContent?.includes("obligations.mujtahids.addRep"),
    );
    expect(addRepButtons.length).toBeGreaterThan(0);

    await act(async () => {
      addRepButtons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Modal should now be open with name input
    const input = document.body.querySelector("#name-form-input") as HTMLInputElement;
    expect(input).not.toBeNull();

    // Type a representative name
    await act(async () => {
      setInputValue(input, "Sayyid Kashmiri");
    });

    // Find and click the Save button inside the modal
    const saveButton = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("common.save"),
    );
    expect(saveButton).toBeDefined();

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChangeReps).toHaveBeenCalledTimes(1);
    const updatedReps = onChangeReps.mock.calls[0]?.[0] as MujtahidRep[];
    expect(updatedReps.length).toBe(2);
    expect(updatedReps[1]?.name).toBe("Sayyid Kashmiri");
    expect(updatedReps[1]?.mujtahid_id).toBe("m1");
    expect(updatedReps[1]?.id.startsWith("mr")).toBe(true);

    // Modal should close on success
    const closedInput = document.body.querySelector("#name-form-input");
    expect(closedInput).toBeNull();
  });

  it("displays error and remains open when onChangeReps fails", async () => {
    const onChangeReps = vi.fn().mockRejectedValue(new Error("Database write error"));

    await act(async () => {
      root.render(
        <MujtahidManager
          mujtahids={sampleMujtahids}
          reps={sampleReps}
          onChangeMujtahids={vi.fn()}
          onChangeReps={onChangeReps}
        />,
      );
    });

    const addRepButtons = Array.from(container.querySelectorAll("button")).filter(
      (btn) =>
        btn.getAttribute("aria-label")?.includes("Ayatollah Sistani") &&
        btn.textContent?.includes("obligations.mujtahids.addRep"),
    );
    await act(async () => {
      addRepButtons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const input = document.body.querySelector("#name-form-input") as HTMLInputElement;
    await act(async () => {
      setInputValue(input, "Failed Rep");
    });

    const saveButton = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("common.save"),
    );
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChangeReps).toHaveBeenCalledTimes(1);

    // Modal should stay open with error displayed
    expect(document.body.querySelector("#name-form-input")).not.toBeNull();
    expect(document.body.textContent).toContain("Database write error");
  });

  it("shows validation error and does not call onChangeReps when name is empty", async () => {
    const onChangeReps = vi.fn();

    await act(async () => {
      root.render(
        <MujtahidManager
          mujtahids={sampleMujtahids}
          reps={sampleReps}
          onChangeMujtahids={vi.fn()}
          onChangeReps={onChangeReps}
        />,
      );
    });

    const addRepButtons = Array.from(container.querySelectorAll("button")).filter(
      (btn) =>
        btn.getAttribute("aria-label")?.includes("Ayatollah Sistani") &&
        btn.textContent?.includes("obligations.mujtahids.addRep"),
    );
    await act(async () => {
      addRepButtons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const saveButton = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("common.save"),
    );
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChangeReps).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("obligations.mujtahids.nameRequired");
  });

  it("deletes a representative when delete button is clicked and confirmed", async () => {
    const onChangeReps = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <MujtahidManager
          mujtahids={sampleMujtahids}
          reps={sampleReps}
          onChangeMujtahids={vi.fn()}
          onChangeReps={onChangeReps}
        />,
      );
    });

    // Expand Ayatollah Sistani's reps
    const expandButton = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Ayatollah Sistani"),
    );
    await act(async () => {
      expandButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Find delete button for Representative A
    const deleteRepBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.getAttribute("aria-label")?.includes("obligations.mujtahids.repDeleteAria"),
    );
    expect(deleteRepBtn).toBeDefined();

    await act(async () => {
      deleteRepBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // ConfirmAlertDialog is open, find confirm button in confirm-dialog
    const confirmButton = container.querySelector('[data-testid="confirm-dialog"] button');
    expect(confirmButton).not.toBeNull();

    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChangeReps).toHaveBeenCalledTimes(1);
    expect(onChangeReps).toHaveBeenCalledWith([]);
  });
});
