import React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    lazy: (importer: () => Promise<{ default: React.ComponentType<any> }>) => {
      let Component: React.ComponentType<any> | null = null;
      importer().then((m) => {
        Component = m.default;
      });
      return (props: any) => {
        if (Component) {
          return React.createElement(Component, props);
        }
        return <div data-testid="lazy-loading" />;
      };
    },
  };
});

import { ObligationsSetupTier } from "./ObligationsSetupTier";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/ModuleTierMotion", () => ({
  ModuleTierMotion: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="module-tier-motion">{children}</div>
  ),
}));

vi.mock("@/components/app/SetupReadOnlyMessage", () => ({
  SetupReadOnlyMessage: ({ title }: { title: string }) => (
    <div data-testid="setup-read-only-message">{title}</div>
  ),
}));

vi.mock("@/components/app/SubTabBar", () => ({
  SubTabBar: () => <div data-testid="sub-tab-bar">SubTabBar</div>,
}));

vi.mock("./ObligationTypeManager", () => ({
  default: () => <div data-testid="obligation-type-manager">Obligation Type Manager</div>,
  ObligationTypeManager: () => (
    <div data-testid="obligation-type-manager">Obligation Type Manager</div>
  ),
}));

vi.mock("./MujtahidManager", () => ({
  default: () => <div data-testid="mujtahid-manager">Mujtahid Manager</div>,
  MujtahidManager: () => <div data-testid="mujtahid-manager">Mujtahid Manager</div>,
}));

vi.mock("./WakalaTypeManager", () => ({
  default: () => <div data-testid="wakala-type-manager">Wakala Type Manager</div>,
  WakalaTypeManager: () => <div data-testid="wakala-type-manager">Wakala Type Manager</div>,
}));

vi.mock("@/tenant/features/obligations/components/invoice/InvoiceTemplateEditor", () => ({
  default: (props: { obligationTypes?: unknown[]; mujtahids?: unknown[]; reps?: unknown[] }) => (
    <div
      data-testid="invoice-template-editor"
      data-types-count={props.obligationTypes?.length ?? 0}
      data-mujtahids-count={props.mujtahids?.length ?? 0}
      data-reps-count={props.reps?.length ?? 0}
    >
      Invoice Template Editor
    </div>
  ),
  InvoiceTemplateEditor: (props: {
    obligationTypes?: unknown[];
    mujtahids?: unknown[];
    reps?: unknown[];
  }) => (
    <div
      data-testid="invoice-template-editor"
      data-types-count={props.obligationTypes?.length ?? 0}
      data-mujtahids-count={props.mujtahids?.length ?? 0}
      data-reps-count={props.reps?.length ?? 0}
    >
      Invoice Template Editor
    </div>
  ),
}));

vi.mock("@/tenant/features/obligations/components/ObligationsReceiptNumberingSection", () => ({
  default: () => (
    <div data-testid="obligations-receipt-numbering-section">Receipt Numbering Section</div>
  ),
  ObligationsReceiptNumberingSection: () => (
    <div data-testid="obligations-receipt-numbering-section">Receipt Numbering Section</div>
  ),
}));

describe("ObligationsSetupTier Component", () => {
  beforeAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  const defaultProps = {
    tabs: [
      { id: "wakala", label: "Wakala" },
      { id: "numbering", label: "Receipt Numbering" },
      { id: "invoice_template", label: "Invoice Template" },
    ],
    activeTab: "wakala",
    canEditSetup: true,
    obligationTypes: [{ id: "type-1", name: "Khums" } as any],
    mujtahids: [{ id: "muj-1", name: "Sistani" } as any],
    reps: [{ id: "rep-1", name: "Representative" } as any],
    wakalaTypes: [],
    distributions: [],
    onTabChange: vi.fn(),
    onChangeTypes: vi.fn(),
    onChangeMujtahids: vi.fn(),
    onChangeReps: vi.fn(),
    onChangeWakala: vi.fn(),
    onChangeDistributions: vi.fn(),
  };

  it("renders subtab bar and tier motion in editable mode", () => {
    const html = renderToStaticMarkup(<ObligationsSetupTier {...defaultProps} />);
    expect(html).toContain("module-tier-motion");
    expect(html).toContain("SubTabBar");
    expect(html).toContain("wakala-type-manager");
  });

  it("renders invoice template editor with lookups when activeTab is invoice_template", () => {
    const html = renderToStaticMarkup(
      <ObligationsSetupTier {...defaultProps} activeTab="invoice_template" />,
    );
    expect(html).toContain("invoice-template-editor");
    expect(html).toContain('data-types-count="1"');
    expect(html).toContain('data-mujtahids-count="1"');
    expect(html).toContain('data-reps-count="1"');
  });

  it("renders receipt numbering section when activeTab is numbering", () => {
    const html = renderToStaticMarkup(
      <ObligationsSetupTier
        {...defaultProps}
        tabs={[...defaultProps.tabs, { id: "numbering", label: "Receipt Numbering" }]}
        activeTab="numbering"
      />,
    );
    expect(html).toContain("obligations-receipt-numbering-section");
  });

  it("renders read-only message when canEditSetup is false", () => {
    const html = renderToStaticMarkup(
      <ObligationsSetupTier {...defaultProps} canEditSetup={false} />,
    );
    expect(html).toContain("setup-read-only-message");
    expect(html).toContain("obligations.setup.readOnly");
  });
});
