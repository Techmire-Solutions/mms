import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "@mms/shared";
import { useSessionRolloverForm, type SessionRolloverForm } from "./useSessionRolloverForm";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const session = {
  id: "sess-1",
  name: "Hifz 2026",
  startDate: "2026-01-01",
  endDate: "2026-06-30",
  classes: [],
} as unknown as Session;

function Harness({ onReady }: { onReady: (form: SessionRolloverForm) => void }) {
  const form = useSessionRolloverForm(session, "promote");
  onReady(form);
  return null;
}

describe("useSessionRolloverForm", () => {
  let container: HTMLDivElement;
  let root: Root;
  let form: SessionRolloverForm;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<Harness onReady={(next) => (form = next)} />);
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("invalidates a preview when the target dates change", async () => {
    await act(async () => {
      form.setPreview([
        {
          enrollmentId: "e1",
          studentName: "Ali",
          fromClassId: "",
          toClassId: "",
          outcome: "promote",
          problems: [],
        },
      ]);
    });
    expect(form.preview).toHaveLength(1);

    await act(async () => form.setStartDate("2027-02-01"));
    expect(form.preview).toBeNull();

    await act(async () => {
      form.setPreview([
        {
          enrollmentId: "e1",
          studentName: "Ali",
          fromClassId: "",
          toClassId: "",
          outcome: "promote",
          problems: [],
        },
      ]);
    });
    await act(async () => form.setEndDate("2027-08-01"));
    expect(form.preview).toBeNull();
  });

  it("clears preview and reports dirty state for copy/name changes", async () => {
    await act(async () => {
      form.setPreview([
        {
          enrollmentId: "e1",
          studentName: "Ali",
          fromClassId: "",
          toClassId: "",
          outcome: "promote",
          problems: [],
        },
      ]);
    });
    await act(async () => form.setName("Next Session"));
    expect(form.preview).toBeNull();
    expect(form.isDirty).toBe(true);

    await act(async () => {
      form.setPreview([
        {
          enrollmentId: "e1",
          studentName: "Ali",
          fromClassId: "",
          toClassId: "",
          outcome: "promote",
          problems: [],
        },
      ]);
      form.toggleCopy("fees", false);
    });
    expect(form.preview).toBeNull();
    expect(form.isDirty).toBe(true);
  });
});
