import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagingSetupTemplateForm } from "./MessagingSetupTemplateForm";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/MessagingVariableTokensBar", () => ({
  MessagingVariableTokensBar: () => <div data-testid="tokens-bar">Tokens</div>,
}));

describe("MessagingSetupTemplateForm Component", () => {
  let container: HTMLDivElement;
  let root: Root;

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

  it("renders form fields with explicit id and Field wrappers", async () => {
    await act(async () => {
      root.render(
        <MessagingSetupTemplateForm
          open
          editingId={null}
          label="Welcome"
          body="Welcome {name}"
          category="general"
          channel="all"
          templateCategorySelectOptions={[{ value: "general", label: "General" }]}
          channelSelectOptions={[{ value: "all", label: "All" }]}
          onReset={vi.fn()}
          onSave={vi.fn()}
          onLabelChange={vi.fn()}
          onBodyChange={vi.fn()}
          onCategoryChange={vi.fn()}
          onChannelChange={vi.fn()}
        />,
      );
    });

    const labelInput = document.body.querySelector("#tplLabel") as HTMLInputElement;
    const bodyTextarea = document.body.querySelector("#tplBody") as HTMLTextAreaElement;

    expect(labelInput).not.toBeNull();
    expect(labelInput.value).toBe("Welcome");
    expect(bodyTextarea).not.toBeNull();
    expect(bodyTextarea.value).toBe("Welcome {name}");
  });

  it("renders validation error message and sets aria-invalid when errors are provided", async () => {
    await act(async () => {
      root.render(
        <MessagingSetupTemplateForm
          open
          editingId={null}
          label=""
          body=""
          category="general"
          channel="all"
          templateCategorySelectOptions={[{ value: "general", label: "General" }]}
          channelSelectOptions={[{ value: "all", label: "All" }]}
          errors={{
            label: "Label is required",
            body: "Body is required",
          }}
          onReset={vi.fn()}
          onSave={vi.fn()}
          onLabelChange={vi.fn()}
          onBodyChange={vi.fn()}
          onCategoryChange={vi.fn()}
          onChannelChange={vi.fn()}
        />,
      );
    });

    const labelInput = document.body.querySelector("#tplLabel") as HTMLInputElement;
    const bodyTextarea = document.body.querySelector("#tplBody") as HTMLTextAreaElement;

    expect(labelInput.getAttribute("aria-invalid")).toBe("true");
    expect(bodyTextarea.getAttribute("aria-invalid")).toBe("true");
    expect(document.body.textContent).toContain("Label is required");
    expect(document.body.textContent).toContain("Body is required");
  });
});
