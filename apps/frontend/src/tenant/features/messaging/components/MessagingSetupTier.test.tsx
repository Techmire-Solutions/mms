import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessagingSetupTier } from "./MessagingSetupTier";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1" },
  }),
}));

vi.mock("@/hooks/useMessaging", () => ({
  useMessageTemplates: () => ({
    templates: [],
    isError: false,
    refetch: vi.fn(),
  }),
  useMessagingMutations: () => ({
    saveTemplate: { mutateAsync: vi.fn() },
  }),
}));

vi.mock("../hooks/useMessagingPageOptions", () => ({
  useMessagingPageOptions: () => ({
    categorySelectOptions: [],
    templateCategorySelectOptions: [],
    channelSelectOptions: [],
    categoryBadgeConfig: {},
  }),
}));

vi.mock("@/components/app/ModuleTierMotion", () => ({
  ModuleTierMotion: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="module-tier-motion">{children}</div>
  ),
}));

vi.mock("@/components/app/SubTabBar", () => ({
  SubTabBar: () => <div data-testid="sub-tab-bar">SubTabBar</div>,
}));

vi.mock("@/components/app/SetupReadOnlyMessage", () => ({
  SetupReadOnlyMessage: ({ title }: { title: string }) => (
    <div data-testid="read-only">{title}</div>
  ),
}));

vi.mock("./MessagingSetupTemplateForm", () => ({
  MessagingSetupTemplateForm: () => <div data-testid="template-form">Template Form</div>,
}));

vi.mock("./MessagingTemplateList", () => ({
  MessagingTemplateList: () => <div data-testid="template-list">Template List</div>,
}));

describe("MessagingSetupTier Component", () => {
  it("renders module tier motion, template form, and template list in editable mode", () => {
    const html = renderToStaticMarkup(
      <MessagingSetupTier canWrite={true} canEditSetup={true} onDeleteRequest={vi.fn()} />,
    );

    expect(html).toContain("module-tier-motion");
    expect(html).toContain("Template Form");
    expect(html).toContain("Template List");
  });

  it("renders read-only message when canEditSetup is false", () => {
    const html = renderToStaticMarkup(
      <MessagingSetupTier canWrite={false} canEditSetup={false} onDeleteRequest={vi.fn()} />,
    );

    expect(html).toContain("messaging.setup.readOnly");
    expect(html).toContain("read-only");
  });
});
