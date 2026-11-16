import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WakalaFormModalProps } from "./wakala/wakalaFormModalTypes";
import { WakalaFormModal } from "./WakalaFormModal";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const harness = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  captured: {} as { saveDisabled?: boolean; error?: string[] },
}));

vi.mock("@/hooks/useTranslation", async () => {
  const { useTranslationEnMock } = await import("@/test/useTranslationEnMock");
  return { useTranslation: useTranslationEnMock() };
});

vi.mock("./wakala/useWakalaFormModalState", () => ({
  useWakalaFormModalState: () => harness.state,
}));

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({
    children,
    saveDisabled,
    error,
  }: {
    children: React.ReactNode;
    saveDisabled?: boolean;
    error?: string[];
  }) => {
    harness.captured.saveDisabled = saveDisabled;
    harness.captured.error = error;
    return <div>{children}</div>;
  },
}));

vi.mock("./wakala/WakalaStepProgressBar", () => ({ WakalaStepProgressBar: () => null }));
vi.mock("./wakala/WakalaStep1MujtahidType", () => ({ WakalaStep1MujtahidType: () => null }));
vi.mock("./wakala/WakalaStep2Representative", () => ({
  WakalaStep2Representative: () => null,
}));
vi.mock("./wakala/WakalaStep3Distribution", () => ({ WakalaStep3Distribution: () => null }));
vi.mock("./wakala/WakalaQuickCreateModals", () => ({ WakalaQuickCreateModals: () => null }));

const props: WakalaFormModalProps = {
  title: "Wakala",
  initial: { id: "wakala-1" },
  reps: [],
  mujtahids: [],
  obligationTypes: [],
  onSave: vi.fn(),
  onClose: vi.fn(),
};

function wakalaState(totalPercentage: number): Record<string, unknown> {
  return {
    step: 3,
    totalPercentage,
    errors: {},
    submitError: "",
    saving: false,
    isChildModalOpen: false,
    selectedMujtahidId: "m1",
    selectedObTypeId: "t1",
    selectedRepId: "r1",
    handleNextOrSave: vi.fn(),
  };
}

describe("WakalaFormModal distribution total", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    harness.captured = {};
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async (totalPercentage: number) => {
    harness.state = wakalaState(totalPercentage);
    await act(async () => {
      root.render(<WakalaFormModal {...props} />);
    });
  };

  it("blocks Save at 60% and explains the missing 40%", async () => {
    await render(60);

    expect(harness.captured.saveDisabled).toBe(true);
    expect(harness.captured.error?.join(" ")).toContain(
      "Distributions total 60% — must equal 100%",
    );
  });

  it("allows Save at 100%", async () => {
    await render(100);

    expect(harness.captured.saveDisabled).toBe(false);
    // With a complete split there is no error banner at all.
    expect(harness.captured.error ?? []).toHaveLength(0);
  });
});
