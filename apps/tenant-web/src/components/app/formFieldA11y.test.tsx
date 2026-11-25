import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { CheckboxField } from "@mms/ui";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { Input } from "@mms/ui";

async function render(
  element: React.ReactElement,
): Promise<{ container: HTMLDivElement; cleanup: () => Promise<void> }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    cleanup: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("form field accessibility", () => {
  it("associates a Field label, hint, error and aria state with its input", async () => {
    const { container, cleanup } = await render(
      <Field id="student-name" label="Student name" required error="Name is required">
        <Input id="student-name" value="" onChange={() => {}} />
      </Field>,
    );
    await act(async () => {});

    const input = container.querySelector<HTMLInputElement>("#student-name");
    const label = container.querySelector<HTMLLabelElement>('label[for="student-name"]');
    expect(label?.textContent).toContain("Student name");
    expect(input?.getAttribute("aria-invalid")).toBe("true");
    expect(input?.getAttribute("aria-describedby")).toBe("student-name-error");
    expect(container.querySelector("#student-name-error")?.textContent).toContain(
      "Name is required",
    );

    await cleanup();
  });

  it("uses the hint as description when there is no error", async () => {
    const { container, cleanup } = await render(
      <Field id="student-code" label="Code" hint="Unique code">
        <Input id="student-code" value="" onChange={() => {}} />
      </Field>,
    );
    await act(async () => {});

    const input = container.querySelector<HTMLInputElement>("#student-code");
    expect(input?.getAttribute("aria-describedby")).toBe("student-code-hint");
    expect(container.querySelector("#student-code-hint")?.textContent).toContain("Unique code");

    await cleanup();
  });

  it("wires CheckboxField label and description", async () => {
    const { container, cleanup } = await render(
      <CheckboxField
        id="terms"
        name="terms"
        checked={false}
        onCheckedChange={() => {}}
        label="Accept terms"
        description="Required to continue"
      />,
    );
    await act(async () => {});

    const checkbox = container.querySelector<HTMLButtonElement>("#terms");
    expect(container.querySelector('label[for="terms"]')?.textContent).toContain("Accept terms");
    expect(checkbox?.getAttribute("aria-describedby")).toBe("terms-description");
    expect(container.querySelector("#terms-description")?.textContent).toContain(
      "Required to continue",
    );

    await cleanup();
  });
});
