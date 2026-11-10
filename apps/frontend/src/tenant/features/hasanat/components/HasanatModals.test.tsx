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

vi.mock("@/components/app/FormModal", () => ({
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

vi.mock("@/components/app/DatePicker", () => ({
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
    pointsSnapshot: 20,
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
      expect(rewardError).not.toBeNull();
      // Points are never empty: they come from the card's stamped value.
      expect(container.querySelector("#pts-used-error")).toBeNull();
    });

    it("submits one idempotent redemption on a double click", async () => {
      const onSave = vi.fn(async (_redemption: { clientRequestId?: string }) => undefined);
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
      await act(async () => {
        setInputValue(rewardInput, "Book Voucher");
      });

      const saveBtn = container.querySelector(
        '[data-testid="modal-save-btn"]',
      ) as HTMLButtonElement;
      await act(async () => {
        saveBtn.click();
        saveBtn.click();
      });

      expect(onSave).toHaveBeenCalledTimes(1);
      const payload = onSave.mock.calls[0]?.[0];
      expect(payload.clientRequestId).toMatch(/^redreq[0-9a-f-]{20,}$/);
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
      // The card value is stamped and locked — the operator cannot send a partial redemption.
      expect((ptsInput as HTMLInputElement).readOnly).toBe(true);
      expect((ptsInput as HTMLInputElement).value).toBe("20");
      const saveBtn = container.querySelector(
        '[data-testid="modal-save-btn"]',
      ) as HTMLButtonElement;

      await act(async () => {
        setInputValue(rewardInput, "Book Voucher");
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

    it("preserves the redemption draft when the distributions array is refetched", async () => {
      await act(async () => {
        root.render(
          <RedeemModal
            open={true}
            distributions={mockDistributions}
            onClose={vi.fn()}
            onSave={vi.fn()}
          />,
        );
      });

      const rewardInput = container.querySelector("#reward-given") as HTMLInputElement;
      await act(async () => {
        setInputValue(rewardInput, "Draft reward survives refetch");
      });

      await act(async () => {
        root.render(
          <RedeemModal
            open={true}
            distributions={[...mockDistributions]}
            onClose={vi.fn()}
            onSave={vi.fn()}
          />,
        );
      });

      expect((container.querySelector("#reward-given") as HTMLInputElement).value).toBe(
        "Draft reward survives refetch",
      );
    });
  });

  describe("StockAddBatchModal", () => {
    it("submits one batch on a double click", async () => {
      const onSave = vi.fn(async () => undefined);
      await act(async () => {
        root.render(
          <StockAddBatchModal open={true} denoms={mockDenoms} onClose={vi.fn()} onSave={onSave} />,
        );
      });

      const qtyInput = container.querySelector("#batch-qty") as HTMLInputElement;
      await act(async () => {
        setInputValue(qtyInput, "5");
      });

      const saveBtn = container.querySelector(
        '[data-testid="modal-save-btn"]',
      ) as HTMLButtonElement;
      await act(async () => {
        saveBtn.click();
        saveBtn.click();
      });

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("preserves the batch draft when the denominations array is refetched", async () => {
      await act(async () => {
        root.render(
          <StockAddBatchModal open={true} denoms={mockDenoms} onClose={vi.fn()} onSave={vi.fn()} />,
        );
      });

      const qtyInput = container.querySelector("#batch-qty") as HTMLInputElement;
      const noteInput = container.querySelector("#batch-note") as HTMLInputElement;
      await act(async () => {
        setInputValue(qtyInput, "7");
        setInputValue(noteInput, "Draft note survives refetch");
      });

      await act(async () => {
        root.render(
          <StockAddBatchModal
            open={true}
            denoms={[...mockDenoms]}
            onClose={vi.fn()}
            onSave={vi.fn()}
          />,
        );
      });

      expect((container.querySelector("#batch-qty") as HTMLInputElement).value).toBe("7");
      expect((container.querySelector("#batch-note") as HTMLInputElement).value).toBe(
        "Draft note survives refetch",
      );
    });

    it("shows the server error and keeps the draft when the batch save is rejected", async () => {
      const onSave = vi.fn(async () => {
        throw new Error("batch save rejected");
      });
      await act(async () => {
        root.render(
          <StockAddBatchModal open={true} denoms={mockDenoms} onClose={vi.fn()} onSave={onSave} />,
        );
      });

      const qtyInput = container.querySelector("#batch-qty") as HTMLInputElement;
      await act(async () => {
        setInputValue(qtyInput, "5");
      });

      await act(async () => {
        (container.querySelector('[data-testid="modal-save-btn"]') as HTMLButtonElement).click();
      });

      expect(container.querySelector('[data-testid="modal-error"]')?.textContent).toBe(
        "batch save rejected",
      );
      expect((container.querySelector("#batch-qty") as HTMLInputElement).value).toBe("5");
    });

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
    it("submits one denomination on a double click", async () => {
      const onSave = vi.fn(async () => undefined);
      await act(async () => {
        root.render(
          <DenominationModal open={true} denom={null} onClose={vi.fn()} onSave={onSave} />,
        );
      });

      const nameInput = container.querySelector("#denom-name") as HTMLInputElement;
      await act(async () => {
        setInputValue(nameInput, "Gold Crown");
      });

      const saveBtn = container.querySelector(
        '[data-testid="modal-save-btn"]',
      ) as HTMLButtonElement;
      await act(async () => {
        saveBtn.click();
        saveBtn.click();
      });

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("rejects a denomination name that already exists", async () => {
      const onSave = vi.fn();
      await act(async () => {
        root.render(
          <DenominationModal
            open={true}
            denom={null}
            existingDenoms={mockDenoms}
            onClose={vi.fn()}
            onSave={onSave}
          />,
        );
      });

      const nameInput = container.querySelector("#denom-name") as HTMLInputElement;
      await act(async () => {
        // Same name in a different case must be rejected (imports resolve deeds by name).
        setInputValue(nameInput, "silver star");
      });

      const saveBtn = container.querySelector(
        '[data-testid="modal-save-btn"]',
      ) as HTMLButtonElement;
      await act(async () => {
        saveBtn.click();
      });

      expect(onSave).not.toHaveBeenCalled();
      expect(container.querySelector("#denom-name-error")?.textContent).toBe(
        "hasanat.denominations.duplicateName",
      );
    });

    it("shows the server error and keeps the draft when the denomination save is rejected", async () => {
      const onSave = vi.fn(async () => {
        throw new Error("denomination save rejected");
      });
      await act(async () => {
        root.render(
          <DenominationModal open={true} denom={null} onClose={vi.fn()} onSave={onSave} />,
        );
      });

      const nameInput = container.querySelector("#denom-name") as HTMLInputElement;
      await act(async () => {
        setInputValue(nameInput, "Gold Crown");
      });

      await act(async () => {
        (container.querySelector('[data-testid="modal-save-btn"]') as HTMLButtonElement).click();
      });

      expect(container.querySelector('[data-testid="modal-error"]')?.textContent).toBe(
        "denomination save rejected",
      );
      expect((container.querySelector("#denom-name") as HTMLInputElement).value).toBe("Gold Crown");
    });

    it("labels each preset icon button for assistive tech", async () => {
      await act(async () => {
        root.render(
          <DenominationModal open={true} denom={null} onClose={vi.fn()} onSave={vi.fn()} />,
        );
      });

      const iconButtons = [
        ...container.querySelectorAll<HTMLButtonElement>(
          'button[aria-label^="hasanat.denominations.icon:"]',
        ),
      ];
      expect(iconButtons.length).toBeGreaterThan(0);
      expect(iconButtons.every((button) => Boolean(button.getAttribute("aria-label")))).toBe(true);
    });

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
