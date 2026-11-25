import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { MujtahidRep } from "@/lib/data/obligationsData";
import { useWakalaFormModalState } from "./useWakalaFormModalState";
import type { WakalaFormModalProps } from "./wakalaFormModalTypes";

type State = ReturnType<typeof useWakalaFormModalState>;

function Harness({
  props,
  onReady,
}: {
  props: WakalaFormModalProps;
  onReady: (state: State) => void;
}) {
  onReady(useWakalaFormModalState(props));
  return null;
}

const baseProps: WakalaFormModalProps = {
  title: "Wakala",
  initial: {
    id: "wakala-1",
    mujtahid_representative_id: "rep-1",
    obligation_type_id: "type-1",
  },
  reps: [{ id: "rep-1", mujtahid_id: "mujtahid-1" } as MujtahidRep],
  mujtahids: [],
  obligationTypes: [],
  onSave: vi.fn(),
  onClose: vi.fn(),
  initialDistributions: [
    { id: "dist-1", name: "Share A", percentage: 40, type: "Income" },
    { id: "dist-2", name: "Share B", percentage: 60, type: "Liability" },
  ],
};

describe("useWakalaFormModalState", () => {
  it("hydrates the stored split rules when editing", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let state: State | undefined;

    await act(async () => {
      root.render(<Harness props={baseProps} onReady={(next) => (state = next)} />);
    });

    expect(state!.initialDistributions).toHaveLength(2);
    expect(state!.totalPercentage).toBe(100);
    expect(state!.selectedMujtahidId).toBe("mujtahid-1");

    // Switching to another wakala re-seeds instead of keeping the first record's rules.
    await act(async () => {
      root.render(
        <Harness
          props={{
            ...baseProps,
            initial: { ...baseProps.initial, id: "wakala-2" },
            initialDistributions: [{ id: "dist-3", name: "Only", percentage: 100, type: "Income" }],
          }}
          onReady={(next) => (state = next)}
        />,
      );
    });

    expect(state!.initialDistributions).toEqual([
      { id: "dist-3", name: "Only", percentage: 100, type: "Income" },
    ]);
    expect(state!.totalPercentage).toBe(100);

    await act(async () => root.unmount());
    container.remove();
  });

  it("rejects an empty percentage instead of coercing it to 0", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let state: State | undefined;

    await act(async () => {
      root.render(
        <Harness
          props={{
            ...baseProps,
            initialDistributions: [
              { id: "dist-1", name: "Share A", percentage: null, type: "Income" },
            ],
          }}
          onReady={(next) => (state = next)}
        />,
      );
    });

    let valid = true;
    await act(async () => {
      valid = state!.validateStep3();
    });

    expect(valid).toBe(false);
    expect(state!.errors.dist).toBe("obligations.wakala.pctInvalid");

    await act(async () => root.unmount());
    container.remove();
  });
});
