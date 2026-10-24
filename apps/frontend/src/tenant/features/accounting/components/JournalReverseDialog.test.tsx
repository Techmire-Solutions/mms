import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_TRANSLATIONS_EN, type FiscalYear } from "@mms/shared";
import type { JournalEntry } from "@/lib/data/accountingData";
import { JournalReverseDialog } from "./JournalReverseDialog";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    language: "en",
    direction: "ltr",
    t: (key: string, params?: Record<string, string | number>) => {
      const template = (APP_TRANSLATIONS_EN as Record<string, string>)[key] ?? key;
      return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(params?.[name] ?? ""));
    },
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useAccountingCurrency: () => ({ formatCurrency: (value: number) => `PKR ${value}` }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", name: "Amina Accountant" } }),
}));

const year = (
  id: string,
  startDate: string,
  endDate: string,
  status: FiscalYear["status"],
): FiscalYear => ({
  id,
  label: id,
  startDate,
  endDate,
  status,
});
const FY2025_CLOSED = year("FY2025", "2025-01-01", "2025-12-31", "closed");
const FY2026_OPEN = year("FY2026", "2026-01-01", "2026-12-31", "active");
const FY2026_CLOSED = year("FY2026", "2026-01-01", "2026-12-31", "closed");

const entry = (date: string): JournalEntry => ({
  id: "je-1",
  ref: "JV-0001",
  date,
  description: "Office supplies",
  status: "posted",
  created_by: "Amina",
  fiscal_year: "",
  tags: [],
  attachments: [],
  lines: [
    { id: "l1", account_id: "office", debit: 50000, credit: 0, description: "" },
    { id: "l2", account_id: "cash", debit: 0, credit: 50000, description: "" },
  ],
});

function typeInto(element: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

function button(name: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === name,
  );
}

describe("JournalReverseDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T10:00:00Z"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  async function renderDialog(original: JournalEntry, fiscalYears: FiscalYear[]) {
    const onConfirm = vi.fn<(request: unknown) => Promise<boolean>>().mockResolvedValue(true);
    await act(async () => {
      root.render(
        <JournalReverseDialog
          entry={original}
          fiscalYears={fiscalYears}
          onOpenChange={vi.fn()}
          onConfirm={onConfirm}
        />,
      );
    });
    return onConfirm;
  }

  async function fillReasonAndConfirm(reason: string): Promise<void> {
    const reasonField = document.body.querySelector<HTMLTextAreaElement>("textarea[required]");
    expect(reasonField).toBeInstanceOf(HTMLTextAreaElement);
    await act(async () => typeInto(reasonField!, reason));
    await act(async () => button("Reverse")?.click());
  }

  it("given an open original period, should show the original details and default to the original posting date", async () => {
    // Arrange
    const onConfirm = await renderDialog(entry("2026-09-15"), [FY2026_OPEN]);

    // Act
    await fillReasonAndConfirm("Wrong expense account");

    // Assert
    const text = document.body.textContent ?? "";
    const buttonLabels = [...document.body.querySelectorAll("button")].map(
      (candidate) => candidate.textContent ?? "",
    );
    expect(buttonLabels.some((label) => label.startsWith("Use original date"))).toBe(true);
    expect(text).toContain("Are you sure you want to reverse Journal JV-0001?");
    expect(text).toContain("PKR 50000");
    expect(text).toContain("Open");
    expect(text).toContain("REV-JV-0001");
    expect(text).toContain("Reversed by Amina Accountant");
    expect(onConfirm).toHaveBeenCalledWith({ date: "2026-09-15", reason: "Wrong expense account" });
  });

  it("given a closed original period, should explain why and default to today in the open period", async () => {
    // Arrange
    const onConfirm = await renderDialog(entry("2025-09-15"), [FY2025_CLOSED, FY2026_OPEN]);

    // Act
    await fillReasonAndConfirm("Duplicate posting");

    // Assert
    const text = document.body.textContent ?? "";
    expect(text).toContain("The original period is closed");
    expect(text).toContain("Prior Period");
    const buttonLabels = [...document.body.querySelectorAll("button")].map(
      (candidate) => candidate.textContent ?? "",
    );
    expect(buttonLabels.some((label) => label.startsWith("Use original date"))).toBe(false);
    expect(onConfirm).toHaveBeenCalledWith({ date: "2026-10-08", reason: "Duplicate posting" });
  });

  it("given no reason, should show the required-reason error and not reverse", async () => {
    // Arrange
    const onConfirm = await renderDialog(entry("2026-09-15"), [FY2026_OPEN]);

    // Act
    await act(async () => button("Reverse")?.click());

    // Assert
    expect(document.body.textContent).toContain("Enter the reason for this reversal.");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("given neither the original date nor today is in an open period, should block the reversal until a date is chosen", async () => {
    // Arrange
    const onConfirm = await renderDialog(entry("2026-09-15"), [FY2026_CLOSED]);

    // Act
    await fillReasonAndConfirm("Wrong account");

    // Assert
    expect(document.body.textContent).toContain("Today is not in an open period either");
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
