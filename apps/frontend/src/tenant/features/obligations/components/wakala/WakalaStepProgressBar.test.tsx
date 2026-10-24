import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { WakalaStepProgressBar } from "./WakalaStepProgressBar";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("WakalaStepProgressBar", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("does not run step validators during render", async () => {
    const validateStep1 = vi.fn(() => true);
    const validateStep2 = vi.fn(() => true);

    await act(async () => {
      root.render(
        <WakalaStepProgressBar
          step={1}
          onSetStep={vi.fn()}
          validateStep1={validateStep1}
          validateStep2={validateStep2}
        />,
      );
    });

    expect(validateStep1).not.toHaveBeenCalled();
    expect(validateStep2).not.toHaveBeenCalled();
  });

  it("validates before advancing when a later step is clicked", async () => {
    const validateStep1 = vi.fn(() => true);
    const validateStep2 = vi.fn(() => true);
    const onSetStep = vi.fn();

    await act(async () => {
      root.render(
        <WakalaStepProgressBar
          step={1}
          onSetStep={onSetStep}
          validateStep1={validateStep1}
          validateStep2={validateStep2}
        />,
      );
    });

    const stepButtons = Array.from(container.querySelectorAll("button"));
    expect(stepButtons).toHaveLength(3);

    await act(async () => {
      stepButtons[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(validateStep1).toHaveBeenCalledTimes(1);
    expect(onSetStep).toHaveBeenCalledWith(2);
  });

  it("does not advance when validation fails", async () => {
    const onSetStep = vi.fn();

    await act(async () => {
      root.render(
        <WakalaStepProgressBar
          step={1}
          onSetStep={onSetStep}
          validateStep1={vi.fn(() => false)}
          validateStep2={vi.fn(() => true)}
        />,
      );
    });

    const stepButtons = Array.from(container.querySelectorAll("button"));
    await act(async () => {
      stepButtons[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSetStep).not.toHaveBeenCalled();
  });
});
