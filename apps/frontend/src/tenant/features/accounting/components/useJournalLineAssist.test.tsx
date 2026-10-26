import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalTemplate } from "@mms/shared";
import { useJournalEntryForm } from "../hooks/useJournalEntryForm";
import { applyTemplateToLines, useJournalLineAssist } from "../hooks/useJournalLineAssist";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/tenant/features/accounting/hooks/useJournalEntryCurrency", () => ({
  useJournalEntryCurrency: () => ({
    functionalCurrency: "PKR",
    currency: "PKR",
    setCurrency: vi.fn(),
    isForeign: false,
    rate: "",
    rateOverride: "",
    setRateOverride: vi.fn(),
    lookedUpRate: null,
    rateMissing: false,
    currencyOptions: [{ value: "PKR", label: "PKR" }],
    showCurrencyPicker: false,
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    language: "en",
    t: (key: string) => key,
    isLoading: false,
    dir: "ltr",
    isRtl: false,
  }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Tester" } }),
}));

const pettyCash: JournalTemplate = {
  id: "petty",
  name: "Petty Cash Expense",
  debitAccountId: "a-exp",
  creditAccountId: "a-petty",
};

type Harness = ReturnType<typeof useJournalEntryForm> & {
  assist: ReturnType<typeof useJournalLineAssist>;
};

function TestHarness({ onController }: { onController: (controller: Harness) => void }) {
  const form = useJournalEntryForm({
    accounts: [],
    entries: [],
    onSave: vi.fn(),
    initial: null,
    fiscalYears: [],
  });
  const assist = useJournalLineAssist({
    form: form.form,
    setForm: form.setForm,
    updateLine: form.updateLine,
    toggleTag: form.toggleTag,
    templates: [pettyCash],
  });
  onController({ ...form, assist });
  return null;
}

describe("applyTemplateToLines", () => {
  it("given lines with a typed amount, should set template heads on the first two lines and carry the amount to both sides", () => {
    // Arrange
    const lines = [
      { id: "l1", account_id: "", debit: "", credit: "250", description: "" },
      { id: "l2", account_id: "other", debit: "", credit: "", description: "" },
      { id: "l3", account_id: "x", debit: "5", credit: "", description: "" },
    ];

    // Act
    const result = applyTemplateToLines(lines, pettyCash);

    // Assert
    expect(result.map(({ account_id, debit, credit }) => ({ account_id, debit, credit }))).toEqual([
      { account_id: "a-exp", debit: "250", credit: "" },
      { account_id: "a-petty", debit: "", credit: "250" },
      { account_id: "x", debit: "5", credit: "" },
    ]);
  });
});

describe("useJournalLineAssist", () => {
  let container: HTMLDivElement;
  let root: Root;
  let controller: Harness | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    controller = undefined;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const current = (): Harness => {
    if (!controller) throw new Error("harness not rendered");
    return controller;
  };

  it("given a template tag is picked, should fill its heads, tag the entry and lock each line to its side", () => {
    // Arrange
    act(() =>
      root.render(
        <TestHarness
          onController={(next) => {
            controller = next;
          }}
        />,
      ),
    );

    // Act
    act(() => current().assist.toggleTemplateTag("Petty Cash Expense"));

    // Assert
    const { form, assist } = current();
    expect(form.tags).toEqual(["Petty Cash Expense"]);
    expect(form.lines.map((line) => line.account_id)).toEqual(["a-exp", "a-petty"]);
    expect(assist.lockedSideFor(form.lines[0].id)).toBe("debit");
    expect(assist.lockedSideFor(form.lines[1].id)).toBe("credit");
  });

  it("given the template tag is picked again, should untag the entry and release the locks", () => {
    // Arrange
    act(() =>
      root.render(
        <TestHarness
          onController={(next) => {
            controller = next;
          }}
        />,
      ),
    );
    act(() => current().assist.toggleTemplateTag("Petty Cash Expense"));

    // Act
    act(() => current().assist.toggleTemplateTag("Petty Cash Expense"));

    // Assert
    const { form, assist } = current();
    expect(form.tags).toEqual([]);
    expect(assist.lockedSideFor(form.lines[0].id)).toBeUndefined();
  });

  it("given two lines with mirroring on, should copy a debit amount to the other line's credit", () => {
    // Arrange
    act(() =>
      root.render(
        <TestHarness
          onController={(next) => {
            controller = next;
          }}
        />,
      ),
    );

    // Act
    act(() => current().assist.updateLineAssisted(0, "debit", "1200"));

    // Assert
    const [first, second] = current().form.lines;
    expect([first.debit, first.credit, second.debit, second.credit]).toEqual([
      "1200",
      "",
      "",
      "1200",
    ]);
    expect(current().isBalanced).toBe(true);
  });

  it("given mirroring is switched off, should leave the other line untouched", () => {
    // Arrange
    act(() =>
      root.render(
        <TestHarness
          onController={(next) => {
            controller = next;
          }}
        />,
      ),
    );
    act(() => current().assist.setMirrorAmounts(false));

    // Act
    act(() => current().assist.updateLineAssisted(1, "credit", "75"));

    // Assert
    const [first, second] = current().form.lines;
    expect([first.debit, first.credit, second.credit]).toEqual(["", "", "75"]);
  });
});
