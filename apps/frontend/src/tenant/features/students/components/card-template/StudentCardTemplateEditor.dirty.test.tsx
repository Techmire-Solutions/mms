import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, language: "en", dir: "ltr" }),
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({ madrasaName: "Test Madrasa" }),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/templates/documentTemplatesApi", () => ({
  fetchDocumentTemplateServer: vi.fn(async () => null),
  saveDocumentTemplateServer: vi.fn(async () => ({})),
}));

// The shared editor is replaced by a probe that reproduces the remount contract:
// it reports `false` on mount and can simulate an edit via onChange.
vi.mock("@/components/app/TemplateEditor", () => ({
  TemplateEditor: ({
    template,
    onChange,
    onDirtyChange,
  }: {
    template: { elements?: Array<Record<string, unknown>> };
    onChange?: (next: unknown) => void;
    onDirtyChange?: (dirty: boolean) => void;
  }) => {
    React.useEffect(() => {
      onDirtyChange?.(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <button
        type="button"
        onClick={() =>
          onChange?.({
            ...template,
            elements: [...(template.elements ?? []), { id: "edited", type: "text", label: "x" }],
          })
        }
      >
        mock-edit
      </button>
    );
  },
}));

import StudentCardTemplateEditor from "./StudentCardTemplateEditor";
import { createTestQueryClient, withQueryClient } from "@/test/queryClientTestUtils";

function clickByText(text: string): void {
  const button = Array.from(document.querySelectorAll("button")).find(
    (element) => element.textContent === text,
  );
  if (!button) throw new Error(`button not found: ${text}`);
  act(() => {
    button.click();
  });
}

describe("StudentCardTemplateEditor dirty guard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  it("stays dirty after switching sides, instead of re-baselining to pristine", () => {
    // 2026-11-04 review (S-03): the remounted editor reported `false`, clearing the
    // unsaved-changes guard while the other side's edits were still pending.
    const onDirtyChange = vi.fn();
    act(() => {
      root.render(
        withQueryClient(
          <StudentCardTemplateEditor onClose={vi.fn()} onDirtyChange={onDirtyChange} />,
          createTestQueryClient(),
        ),
      );
    });

    clickByText("mock-edit");
    clickByText("students.cardTemplate.side.back");

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });
});
