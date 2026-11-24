import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformWorkspaceRow } from "@mms/contracts";

vi.mock("@mms/fe-core/components/Modal", () => ({
  Modal: (props: {
    open: boolean;
    title: string;
    subtitle?: string;
    error?: string;
    children: React.ReactNode;
    saveLabel?: string;
    cancelLabel?: string;
    onSave?: () => void;
    saving?: boolean;
  }) =>
    props.open ? (
      <div data-testid="modal">
        <h2>{props.title}</h2>
        {props.subtitle ? <p>{props.subtitle}</p> : null}
        {props.error ? <p data-testid="modal-error">{props.error}</p> : null}
        <div>{props.children}</div>
        <div>{props.cancelLabel}</div>
        <button data-testid="modal-save" type="button" onClick={() => props.onSave?.()}>
          {props.saveLabel}
        </button>
      </div>
    ) : null,
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { PlatformWorkspaceRenameDialog } from "@/platform/features/workspaces/components/PlatformWorkspaceRenameDialog";

const workspace: PlatformWorkspaceRow = {
  subdomain: "darul-ulum",
  madrasaName: "Darul Ulum",
  enabled: true,
  createdAt: "2026-01-01",
};

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  if (container) {
    document.body.removeChild(container);
    container = null;
  }
});

function render(
  onConfirm: (subdomain: string, name: string) => Promise<void>,
  onOpenChange = vi.fn(),
) {
  act(() => {
    root!.render(
      <PlatformWorkspaceRenameDialog
        open
        onOpenChange={onOpenChange}
        workspace={workspace}
        renamePending={false}
        onConfirm={onConfirm}
      />,
    );
  });
  return { onOpenChange };
}

function typeName(value: string): void {
  const input = document.querySelector<HTMLInputElement>('input[name="madrasaName"]')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("PlatformWorkspaceRenameDialog", () => {
  it("prefills the current madrasa name", () => {
    render(vi.fn());
    const input = document.querySelector<HTMLInputElement>('input[name="madrasaName"]')!;
    expect(input.value).toBe("Darul Ulum");
  });

  it("submits a trimmed rename and closes the dialog", async () => {
    const onConfirm = vi.fn(async () => undefined);
    const { onOpenChange } = render(onConfirm);

    typeName("  Renamed Madrasa  ");
    await act(async () => {
      document
        .querySelector<HTMLButtonElement>('[data-testid="modal-save"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onConfirm).toHaveBeenCalledWith("darul-ulum", "Renamed Madrasa");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("rejects a blank name without calling the API", async () => {
    const onConfirm = vi.fn(async () => undefined);
    render(onConfirm);

    typeName("   ");
    await act(async () => {
      document
        .querySelector<HTMLButtonElement>('[data-testid="modal-save"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="modal-error"]')?.textContent).toBe(
      "platform.validationEnterWorkspaceName",
    );
  });

  it("surfaces API errors on the dialog instead of closing", async () => {
    const { ApiError } = await import("@/lib/apiClient");
    const onConfirm = vi.fn(async () => {
      throw new ApiError(404, "Workspace not found", "not_found");
    });
    const { onOpenChange } = render(onConfirm);

    typeName("Renamed Madrasa");
    await act(async () => {
      document
        .querySelector<HTMLButtonElement>('[data-testid="modal-save"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(document.querySelector('[data-testid="modal-error"]')?.textContent).toBe(
      "platform.resourceNotFound",
    );
  });
});
