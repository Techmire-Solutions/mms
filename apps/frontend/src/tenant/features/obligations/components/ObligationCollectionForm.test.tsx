import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ObligationCollectionFormState } from "./ObligationCollectionFormFields";
import { ObligationCollectionForm } from "./ObligationCollectionForm";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/tenant/features/obligations/hooks/useObligationsSettings", () => ({
  useObligationsSettings: () => ({ settings: {} }),
}));

vi.mock("@/tenant/features/obligations/hooks/useObligationCollectionCatalogQuickCreate", () => ({
  useObligationCollectionCatalogQuickCreate: () => ({
    isChildModalOpen: false,
    canAddType: false,
    canAddRep: false,
    openAddType: vi.fn(),
    openAddRep: vi.fn(),
    isAddMujtahidOpen: false,
    closeAddMujtahid: vi.fn(),
    handleSaveMujtahid: vi.fn(),
    isAddRepOpen: false,
    closeAddRep: vi.fn(),
    handleSaveRep: vi.fn(),
    isAddObTypeOpen: false,
    closeAddObType: vi.fn(),
    handleSaveObType: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/obligations/components/wakala/WakalaQuickCreateModals", () => ({
  WakalaQuickCreateModals: () => null,
}));

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// The real fields read the Query-backed catalogues; this spec drives the submit path.
vi.mock("./ObligationCollectionFormFields", () => ({
  ObligationCollectionFormFields: ({
    errors,
  }: {
    errors: Partial<Record<keyof ObligationCollectionFormState, string>>;
  }) => <div data-testid="field-errors">{JSON.stringify(errors)}</div>,
}));

describe("ObligationCollectionForm submit", () => {
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

  it("submitting an incomplete form shows the field errors instead of doing nothing", async () => {
    const onSave = vi.fn();
    await act(async () => {
      root.render(
        <ObligationCollectionForm
          onClose={vi.fn()}
          onSave={onSave}
          obligationTypes={[]}
          wakalaTypes={[]}
          reps={[]}
          mujtahids={[]}
        />,
      );
    });

    const form = container.querySelector<HTMLFormElement>("#obligation-collection-form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    const errors = JSON.parse(
      container.querySelector('[data-testid="field-errors"]')?.textContent ?? "{}",
    ) as Record<string, string>;
    expect(errors.sender_id).toBe("obligations.form.errors.senderRequired");
    expect(errors.amount).toBe("obligations.form.errors.amountRequired");
    expect(errors.obligation_type_id).toBe("obligations.form.errors.typeRequired");
    expect(onSave).not.toHaveBeenCalled();
  });
});
