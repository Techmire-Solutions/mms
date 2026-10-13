import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FinanceSettings } from "./FinanceSettings";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockCanEdit = true;

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canEditSetup: mockCanEdit,
  }),
}));

vi.mock("@/tenant/features/finance/hooks/useFinanceSetupPanelState", () => ({
  useFinanceSetupPanelState: () => ({
    settings: {
      currency: "PKR",
      invoicePrefix: "INV",
      dueDays: "30",
      lateFeePercent: "5",
      taxRate: "0",
      paymentMethods: ["cash", "bank_transfer"],
      autoGenerateInvoice: true,
      sendInvoiceEmail: true,
      allowPartialPayment: true,
      requireApproval: false,
      overdueReminder: true,
      reminderDaysBefore: "3",
      feeReminders: true,
      defaultViewLayout: "list",
    },
    settingsDraft: {
      currency: "PKR",
      invoicePrefix: "INV",
      dueDays: "30",
      lateFeePercent: "5",
      taxRate: "0",
      paymentMethods: ["cash", "bank_transfer"],
      autoGenerateInvoice: true,
      sendInvoiceEmail: true,
      allowPartialPayment: true,
      requireApproval: false,
      overdueReminder: true,
      reminderDaysBefore: "3",
      feeReminders: true,
      defaultViewLayout: "list",
    },
    saved: true,
    saving: false,
    isPrefsDirty: false,
    isDirty: false,
    upd: vi.fn(),
    handleSave: vi.fn(),
  }),
}));

vi.mock("@/components/app/SectionCard", () => ({
  SectionCard: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
    <div data-testid="section-card">
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

vi.mock("./FinancePreferencesSection", () => ({
  FinancePreferencesSection: () => (
    <div data-testid="finance-preferences-section">Finance Preferences Section</div>
  ),
}));

vi.mock("./FinanceInvoiceNumberingSection", () => ({
  FinanceInvoiceNumberingSection: () => (
    <div data-testid="finance-invoice-numbering-section">Invoice Numbering Section</div>
  ),
}));

vi.mock("./FinanceFeeStructuresSection", () => ({
  FinanceFeeStructuresSection: () => (
    <div data-testid="finance-fee-structures-section">Fee Structures</div>
  ),
}));

vi.mock("@/components/app/ModuleSetupSaveFooter", () => ({
  ModuleSetupSaveFooter: () => <div data-testid="save-footer">Save Footer</div>,
}));

describe("FinanceSettings Component", () => {
  it("renders section card, preferences section, and save footer", () => {
    const html = renderToStaticMarkup(<FinanceSettings />);
    expect(html).toContain("finance.settings.title");
    expect(html).toContain("Finance Preferences Section");
    expect(html).toContain("Invoice Numbering Section");
    expect(html).toContain("Save Footer");
  });
});
