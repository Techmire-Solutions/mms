import React, { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";

/**
 * The Work tier renders `ErrorState` on a failed list, but had no loading affordance: the directory
 * showed an empty table during the first fetch, indistinguishable from "no receipts yet"
 * (frontend audit F5).
 */

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/app/ModuleTierMotion", () => ({
  ModuleTierMotion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/app/ErrorState", () => ({
  ErrorState: () => <div data-testid="error-state" />,
}));

vi.mock("@/tenant/features/obligations/components/ObligationCollectionsList", () => ({
  ObligationCollectionsList: () => <div data-testid="collections-list" />,
}));

import { ObligationsWorkTier } from "./ObligationsWorkTier";

const baseProps: Record<string, unknown> = {
  collections: [],
  obligationTypes: [],
  reps: [],
  mujtahids: [],
  wakalaTypes: [],
  distributions: [],
  canWrite: true,
  canDelete: true,
  showDeleted: false,
  listLoadFailed: false,
  columnLayout: {
    isColumnVisible: () => true,
    getColumnWidth: () => undefined,
    setColumnWidth: () => undefined,
  },
};

let host: HTMLDivElement | null = null;

function render(props: Record<string, unknown>): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    const merged = { ...baseProps, ...props } as unknown as React.ComponentProps<
      typeof ObligationsWorkTier
    >;
    root.render(<ObligationsWorkTier {...merged} />);
  });
  return host;
}

afterEach(() => {
  host?.remove();
  host = null;
});

describe("ObligationsWorkTier states", () => {
  it("renders a skeleton instead of the directory while the list loads", () => {
    const container = render({ listLoading: true });

    expect(container.querySelector('[data-testid="collections-list"]')).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("renders the error state, not the skeleton, when the load fails", () => {
    const container = render({ listLoadFailed: true });

    expect(container.querySelector('[data-testid="error-state"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="collections-list"]')).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("renders the directory once loaded", () => {
    const container = render({});

    expect(container.querySelector('[data-testid="collections-list"]')).not.toBeNull();
  });
});
