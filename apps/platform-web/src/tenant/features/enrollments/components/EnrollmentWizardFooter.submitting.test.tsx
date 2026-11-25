import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnrollmentWizardFooter } from "./EnrollmentWizardFooter";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const t = ((key: string) => key) as unknown as Parameters<typeof EnrollmentWizardFooter>[0]["t"];
const steps = [{ id: "student" }, { id: "fee" }] as unknown as Parameters<
  typeof EnrollmentWizardFooter
>[0]["steps"];

describe("EnrollmentWizardFooter", () => {
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

  function render(props: Partial<React.ComponentProps<typeof EnrollmentWizardFooter>>) {
    return act(async () => {
      root.render(
        <EnrollmentWizardFooter
          t={t}
          step={0}
          steps={steps}
          canNext
          canConfirm
          submitting={false}
          onCancel={vi.fn()}
          onPrevious={vi.fn()}
          onNext={vi.fn()}
          onSubmit={vi.fn()}
          {...props}
        />,
      );
    });
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes(label),
    );
    if (!found) throw new Error(`missing button: ${label}`);
    return found as HTMLButtonElement;
  }

  it("blocks Cancel and Previous while the enrollment POST is in flight", async () => {
    await render({ submitting: true });
    expect(button("common.cancel").disabled).toBe(true);
  });

  it("blocks Previous on a later step while submitting", async () => {
    await render({ submitting: true, step: 1 });
    expect(button("common.previous").disabled).toBe(true);
  });

  it("keeps Cancel enabled when idle", async () => {
    await render({ submitting: false });
    expect(button("common.cancel").disabled).toBe(false);
  });
});
