import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsSetupTier } from "./ContactsSetupTier";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/ui/SubTabBar", () => ({
  SubTabBar: ({ tabs }: { tabs: Array<{ key: string; label: string }> }) => (
    <div data-testid="sub-tab-bar">
      {tabs.map((tab) => (
        <span key={tab.key}>{tab.label}</span>
      ))}
    </div>
  ),
}));

vi.mock("@/lib/setup/useModuleSetupSubTabs", () => ({
  useModuleSetupSubTabs: () => ({
    sub: "preferences",
    showPrefs: true,
    showSync: false,
    handleSubTabChange: vi.fn(),
    discardConfirmOpen: false,
    clearPendingSubTab: vi.fn(),
    handleConfirmDiscard: vi.fn(),
  }),
}));

describe("ContactsSetupTier Component", () => {
  it("renders setup tier sub tabs and preferences container", () => {
    const html = renderToStaticMarkup(
      <ContactsSetupTier onImport={vi.fn()} canWrite={true} canEditSetup={true} />,
    );

    expect(html).toContain("sub-tab-bar");
  });
});
