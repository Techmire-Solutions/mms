import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DistributeModal } from "./DistributeModal";
import type { Denomination, StockBatch } from "@/lib/data/hasanatData";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "usr-1", name: "Admin" },
  }),
}));

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useHasanatConfig: () => ({
    fields: {
      denominationId: { required: true },
      recipientType: { required: true },
      recipientName: { required: true },
      quantity: { required: true },
      issuedDate: { required: true },
      reason: { required: true },
      issuedBy: { required: true },
    },
    orderedFields: [
      { id: "denominationId" },
      { id: "recipientType" },
      { id: "recipientName" },
      { id: "quantity" },
      { id: "issuedDate" },
      { id: "reason" },
      { id: "issuedBy" },
    ],
    isFieldEnabled: () => true,
    isFieldRequired: () => true,
  }),
}));

vi.mock("@/components/ui/FormModal", () => ({
  FormModal: ({
    title,
    saveDisabled,
    onSave,
    children,
  }: {
    title: React.ReactNode;
    saveDisabled?: boolean;
    onSave?: () => void;
    children: React.ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      {children}
      <button
        data-testid="distribute-save-btn"
        type="button"
        disabled={saveDisabled}
        onClick={onSave}
      >
        Distribute
      </button>
    </div>
  ),
}));

vi.mock("@/tenant/components/selectors/RegistryPersonSelect", () => ({
  RegistryPersonSelect: ({
    id,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (val: string) => void;
  }) => (
    <input
      data-testid="registry-person-select"
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/tenant/components/selectors/UserActorSelect", () => ({
  UserActorSelect: ({
    id,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (val: string) => void;
  }) => (
    <input
      data-testid="user-actor-select"
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/ui/DatePicker", () => ({
  DatePicker: ({ value, onChange }: { value: string; onChange: (val: string) => void }) => (
    <input
      data-testid="datepicker"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const mockDenoms: Denomination[] = [
  {
    id: "d-1",
    name: "Silver Star",
    description: "Reward for good conduct",
    points: 10,
    color: "#3b82f6",
    icon: "⭐",
    active: true,
  },
];

const mockBatches: StockBatch[] = [
  {
    id: "b-1",
    denominationId: "d-1",
    denominationName: "Silver Star",
    quantity: 100,
    remaining: 50,
    addedDate: "2026-01-01",
    note: "Initial batch",
  },
];

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("DistributeModal Component", () => {
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

  it("renders modal with denomination and quantity inputMode=numeric", async () => {
    await act(async () => {
      root.render(
        <DistributeModal
          open={true}
          denoms={mockDenoms}
          batches={mockBatches}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("hasanat.distributeCards");
    const qtyInput = container.querySelector("#qty") as HTMLInputElement;
    expect(qtyInput).not.toBeNull();
    expect(qtyInput.getAttribute("inputmode")).toBe("numeric");
  });

  it("disables save button when total available is 0 or required fields missing", async () => {
    await act(async () => {
      root.render(
        <DistributeModal
          open={true}
          denoms={mockDenoms}
          batches={[]} // 0 stock
          onClose={vi.fn()}
          onSave={vi.fn()}
        />,
      );
    });

    const saveBtn = container.querySelector(
      '[data-testid="distribute-save-btn"]',
    ) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it("submits valid distribution payload when form is filled", async () => {
    const onSave = vi.fn();

    await act(async () => {
      root.render(
        <DistributeModal
          open={true}
          denoms={mockDenoms}
          batches={mockBatches}
          onClose={vi.fn()}
          onSave={onSave}
        />,
      );
    });

    const recipientInput = container.querySelector(
      '[data-testid="registry-person-select"]',
    ) as HTMLInputElement;
    const reasonInput = container.querySelector("#reason") as HTMLInputElement;
    const saveBtn = container.querySelector(
      '[data-testid="distribute-save-btn"]',
    ) as HTMLButtonElement;

    await act(async () => {
      setInputValue(recipientInput, "student-123");
      setInputValue(reasonInput, "Quran memorization excellence");
    });

    expect(saveBtn.disabled).toBe(false);

    await act(async () => {
      saveBtn.click();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        denominationId: "d-1",
        denominationName: "Silver Star",
        batchId: "b-1",
        recipientType: "student",
        recipientStudentId: "student-123",
        reason: "Quran memorization excellence",
        quantity: 1,
        issuedByUserId: "usr-1",
      }),
    );
  });

  it("displays inline validation errors when submitted without required fields", async () => {
    const onSave = vi.fn();

    await act(async () => {
      root.render(
        <DistributeModal
          open={true}
          denoms={mockDenoms}
          batches={mockBatches}
          onClose={vi.fn()}
          onSave={onSave}
        />,
      );
    });

    const saveBtn = container.querySelector(
      '[data-testid="distribute-save-btn"]',
    ) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);

    await act(async () => {
      saveBtn.click();
    });

    expect(onSave).not.toHaveBeenCalled();
    const recipientError = container.querySelector("#recipient-error");
    const reasonError = container.querySelector("#reason-error");
    expect(recipientError).not.toBeNull();
    expect(reasonError).not.toBeNull();
  });
});
