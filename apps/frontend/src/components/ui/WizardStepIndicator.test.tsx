import React, { act } from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { User, Shield, Lock } from "lucide-react";
import { WizardStepIndicator, type WizardStepItem } from "@/components/ui/WizardStepIndicator";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("WizardStepIndicator", () => {
  const steps: WizardStepItem[] = [
    { id: 1, label: "Profile", icon: User },
    { id: 2, label: "Security", icon: Shield },
    { id: 3, label: "Confirm", icon: Lock },
  ];

  it("renders all steps and marks current step with aria-current", () => {
    const html = renderToStaticMarkup(
      <WizardStepIndicator steps={steps} current={2} ariaLabel="Setup steps" />
    );

    expect(html).toContain('role="list"');
    expect(html).toContain('aria-label="Setup steps"');
    expect(html).toContain('Profile');
    expect(html).toContain('Security');
    expect(html).toContain('Confirm');
    expect(html).toContain('aria-current="step"');
  });

  it("handles string ids seamlessly", () => {
    const stringSteps: WizardStepItem[] = [
      { id: "personal", label: "Personal" },
      { id: "details", label: "Details" },
    ];

    const html = renderToStaticMarkup(
      <WizardStepIndicator steps={stringSteps} current="personal" />
    );
    expect(html).toContain('Personal');
    expect(html).toContain('Details');
    expect(html).toContain('aria-current="step"');
  });

  it("only renders interactive buttons for reached steps by default", () => {
    const html = renderToStaticMarkup(
      <WizardStepIndicator steps={steps} current={2} onStepClick={vi.fn()} />
    );

    // current index 1 => steps 0 and 1 clickable, step 2 is not.
    expect(html.match(/<button/g)).toHaveLength(2);
  });

  it("reports the step and index when a clickable step is activated", async () => {
    const onStepClick = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <WizardStepIndicator
          steps={steps}
          current={1}
          onStepClick={onStepClick}
          isStepClickable={() => true}
        />
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons).toHaveLength(3);

    await act(async () => {
      buttons[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onStepClick).toHaveBeenCalledWith(steps[2], 2);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
