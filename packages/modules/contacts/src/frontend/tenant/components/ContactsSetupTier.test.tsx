import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsSetupTier } from "./ContactsSetupTier.js";

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@mms/ui/app/SubTabBar", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  SubTabBar: ({ tabs }: { tabs: Array<{ key: string; label: string }> }) => (
    <div data-testid="sub-tab-bar">
      {tabs.map((tab) => (
        <span key={tab.key}>{tab.label}</span>
      ))}
    </div>
  ),
}));

vi.mock("@mms/fe-core/hooks/useModuleSetupSubTabs", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
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
