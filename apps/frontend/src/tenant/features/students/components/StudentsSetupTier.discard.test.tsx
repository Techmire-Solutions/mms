import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({ canEditSetup: true }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/ModuleTierMotion", () => ({
  ModuleTierMotion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/app/SubTabBar", () => ({
  SubTabBar: ({
    tabs,
    onChange,
  }: {
    tabs: Array<{ key: string; label: string }>;
    onChange: (key: string) => void;
  }) => (
    <div>
      {tabs.map((tab) => (
        <button key={tab.key} type="button" onClick={() => onChange(tab.key)}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
}));

// The card editor is remounted by the tier's `key={templateGuard.resetNonce}`; the
// first mount marks it dirty (unsaved layout), later mounts report a clean record.
const editorMounts = { count: 0 };
vi.mock("@/tenant/features/students/components/card-template/StudentCardTemplateEditor", () => ({
  default: function MockStudentCardTemplateEditor({
    onDirtyChange,
  }: {
    onDirtyChange?: (dirty: boolean) => void;
  }) {
    React.useEffect(() => {
      editorMounts.count += 1;
      if (editorMounts.count === 1) onDirtyChange?.(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div>card-editor-panel</div>;
  },
}));

vi.mock("@/tenant/features/students/components/StudentsSetupPanel", () => ({
  default: () => <div>prefs-panel</div>,
}));

vi.mock("@/components/app/ConfirmAlertDialog", () => ({
  ConfirmAlertDialog: ({
    open,
    onConfirm,
    onOpenChange,
  }: {
    open: boolean;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div>
        <span>confirm-discard-dialog</span>
        <button type="button" onClick={() => onConfirm()}>
          confirm-discard
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          cancel-discard
        </button>
      </div>
    ) : null,
}));

import { StudentsSetupTier } from "./StudentsSetupTier";

async function clickByText(text: string): Promise<void> {
  const button = Array.from(document.querySelectorAll("button")).find(
    (element) => element.textContent === text,
  );
  if (!button) throw new Error(`button not found: ${text}`);
  await act(async () => {
    button.click();
  });
}

describe("StudentsSetupTier discard guard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    editorMounts.count = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  function renderTier(): void {
    act(() => {
      root.render(<StudentsSetupTier />);
    });
  }

  it("offers a discard confirm when leaving a dirty card template instead of a dead click", async () => {
    // 2026-11-04 review (M4): `useModuleSetupSubTabs` only sets a pending sub-tab when
    // dirty, and the Students tier rendered no dialog, so clicking Preferences did nothing.
    renderTier();
    await clickByText("students.setup.cardTemplate");
    expect(document.body.textContent).toContain("card-editor-panel");

    await clickByText("students.setup.preferences");

    expect(document.body.textContent).toContain("confirm-discard-dialog");
    expect(document.body.textContent).not.toContain("prefs-panel");
  });

  it("keeps the dirty card template when the discard is cancelled", async () => {
    renderTier();
    await clickByText("students.setup.cardTemplate");
    await clickByText("students.setup.preferences");
    await clickByText("cancel-discard");

    expect(document.body.textContent).not.toContain("confirm-discard-dialog");
    expect(document.body.textContent).toContain("card-editor-panel");
  });

  it("discards, remounts the editor, and switches only after confirming", async () => {
    renderTier();
    await clickByText("students.setup.cardTemplate");
    await clickByText("students.setup.preferences");
    await clickByText("confirm-discard");

    expect(document.body.textContent).toContain("prefs-panel");
    expect(document.body.textContent).not.toContain("card-editor-panel");

    // The confirmed discard bumps the editor key, so returning to the card template
    // remounts it from the persisted layout instead of resurrecting the draft.
    await clickByText("students.setup.cardTemplate");
    expect(editorMounts.count).toBe(2);
    expect(document.body.textContent).toContain("card-editor-panel");
    // The remounted editor is clean, so leaving no longer prompts.
    await clickByText("students.setup.preferences");
    expect(document.body.textContent).not.toContain("confirm-discard-dialog");
    expect(document.body.textContent).toContain("prefs-panel");
  });
});
