import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingVoucherTemplateEditor } from "./AccountingVoucherTemplateEditor";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({
    madrasaName: "Dar Ul Quran",
    addressLine1: "Main Road",
    city: "Lahore",
    phone: "0300-0000000",
    logoUrl: null,
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useAccountingCurrency: () => ({
    formatCurrency: (value: number) => `Rs ${value}`,
    activeCurrency: { code: "PKR" },
  }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", name: "Amina Accountant" } }),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

describe("AccountingVoucherTemplateEditor", () => {
  it("given default props, should render an embedded editor with branded sample data and both presets", () => {
    // Act
    const html = renderToStaticMarkup(<AccountingVoucherTemplateEditor onClose={vi.fn()} />);

    // Assert
    expect(html).toContain('role="region"');
    expect(html).toContain("accounting.voucherTemplate.title");
    expect(html).toContain("accounting.voucherTemplate.presetA6");
    expect(html).toContain("accounting.voucherTemplate.presetA5");
    expect(html).toContain("Dar Ul Quran");
    expect(html).toContain("Main Road · Lahore · 0300-0000000");
    expect(html).toContain("Rs 19000");
  });

  it("given fullscreen, should render a modal dialog landmark", () => {
    // Act
    const html = renderToStaticMarkup(<AccountingVoucherTemplateEditor fullscreen onClose={vi.fn()} />);

    // Assert
    expect(html).toContain('role="dialog"');
  });
});
