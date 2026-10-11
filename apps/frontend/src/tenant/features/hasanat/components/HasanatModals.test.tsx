import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RedeemModal } from "./RedeemModal";
import { StockAddBatchModal } from "./StockAddBatchModal";
import { DenominationModal } from "./DenominationModal";
import type { Denomination, Distribution } from "@/lib/data/hasanatData";

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

vi.mock("@/components/ui/FormModal", () => ({
  FormModal: ({
    title,
    saveDisabled,
    onSave,
    error,
    children,
  }: {
    title: React.ReactNode;
    saveDisabled?: boolean;
    onSave?: () => void;
    error?: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="form-modal">
      <h2>{title}</h2>
      {error && <div data-testid="modal-error">{error}</div>}
      {children}
      <button data-testid="modal-save-btn" type="button" disabled={saveDisabled} onClick={onSave}>
        Save
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/DatePicker", () => ({
  DatePicker: ({
    id,
    name,
    value,
    onChange,
  }: {
    id?: string;
    name?: string;
    value?: string;
    onChange: (val: string) => void;
  }) => (
    <input
      data-testid="datepicker"
      id={id}
      name={name}
      value={value || ""}
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
    id?: string;
    value?: string;
    onChange: (val: string, name?: string) => void;
  }) => (
    <input
      data-testid="user-actor-select"
      id={id}
      value={value || ""}
      onChange={(e) => onChange(e.target.value, "User Name")}
    />
  ),
}));

const mockDenoms: Denomination[] = [
  {
    id: "d-1",
    name: "Silver Star",
    description: "Silver reward",
    points: 10,
    color: "#3b82f6",
    icon: "⭐",
    active: true,
  },
];

const mockDistributions: Distribution[] = [
  {
    id: "dist-1",
    denominationId: "d-1",
    denominationName: "Silver Star",
    batchId: "b-1",
    recipientType: "student",
    recipientStudentId: "std-1",
    recipientName: "Ali Ahmed",
    recipientClass: "Hifz A",
    quantity: 2,
    reason: "Exam excellence",
    issuedDate: "2026-01-01",
    issuedByUserId: "usr-1",
    status: "active",
  },
];

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Hasanat Sub-Modals", () => {
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

  describe("RedeemModal", () => {
    it("shows inline validation errors when submitting empty form", async () => {
      const onSave = vi.fn();
      await act(async () => {
        root.render(
          <RedeemModal
            open={true}
            distributions={mockDistributions}
            onClose={vi.fn()}
            onSave={onSave}
          />,
        );
      });

      const saveBtn = container.querySelector(
        '[data-testid="modal-save-btn"]',
      ) as HTMLButtonElement;
      await act(async () => {
        saveBtn.click();
      });

      expect(onSave).not.toHaveBeenCalled();
      const rewardError = container.querySelector("#reward-error");
      const ptsError = container.querySelector("#pts-used-error");
      expect(rewardError).not.toBeNull();
      expect(ptsError).not.toBeNull();
    });

    it("submits redemption when required fields are populated", async () => {
      const onSave = vi.fn();
      await act(async () => {
        root.render(
          <RedeemModal
            open={true}
            distributions={mockDistributions}
            onClose={vi.fn()}
            onSave={onSave}
          />,
        );
      });

      const rewardInput = container.querySelector("#reward-given") as HTMLInputElement;
      const ptsInput = container.querySelector("#pts-used") as HTMLInputElement;
      const saveBtn = container.querySelector(
        '[data-testid="modal-save-btn"]',
      ) as HTMLButtonElement;

      await act(async () => {
        setInputValue(rewardInput, "Book Voucher");
        setInputValue(ptsInput, "20");
      });

      await act(async () => {
        saveBtn.click();
      });

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          distributionId: "dist-1",
          reward: "Book Voucher",
          pointsUsed: 20,
          studentName: "Ali Ahmed",
        }),
      );
    });
  });

  describe("StockAddBatchModal", () => {
    it("validates required fields on batch submission", async () => {
      const onSave = vi.fn();
      await act(async () => {
        root.render(
          <StockAddBatchModal open={true} denoms={mockDenoms} onClose={vi.fn()} onSave={onSave} />,
        );
      });

      const saveBtn = container.querySelector(
        '[data-testid="modal-save-btn"]',
      ) as HTMLButtonElement;
      await act(async () => {
        saveBtn.click();
      });

      expect(onSave).not.toHaveBeenCalled();
      expect(container.querySelector("#batch-qty-error")).not.toBeNull();

      const qtyInput = container.querySelector("#batch-qty") as HTMLInputElement;
      await act(async () => {
        setInputValue(qtyInput, "50");
      });

      await act(async () => {
        saveBtn.click();
      });

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          denominationId: "d-1",
          quantity: 50,
          remaining: 50,
        }),
      );
    });
  });

  describe("DenominationModal", () => {
    it("validates card name and points before saving", async () => {
      const onSave = vi.fn();
      await act(async () => {
        root.render(
          <DenominationModal open={true} denom={null} onClose={vi.fn()} onSave={onSave} />,
        );
      });

      const saveBtn = container.querySelector(
        '[data-testid="modal-save-btn"]',
      ) as HTMLButtonElement;
      await act(async () => {
        saveBtn.click();
      });

      expect(onSave).not.toHaveBeenCalled();
      expect(container.querySelector("#denom-name-error")).not.toBeNull();

      const nameInput = container.querySelector("#denom-name") as HTMLInputElement;
      await act(async () => {
        setInputValue(nameInput, "Platinum Crown");
      });

      await act(async () => {
        saveBtn.click();
      });

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Platinum Crown",
          points: 100,
          active: true,
        }),
      );
    });
  });
});
