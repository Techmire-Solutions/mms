import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import AppLayout from "./AppLayout";

const mockNavState = {
  collapsed: false,
  toggleCollapsed: vi.fn(),
  mobileOpen: false,
  openMobileSidebar: vi.fn(),
  closeMobileSidebar: vi.fn(),
  commandPaletteOpen: false,
  openCommandPalette: vi.fn(),
  closeCommandPalette: vi.fn(),
  toggleCommandPalette: vi.fn(),
};

let mockBranding = {
  logoUrl: "",
  madrasaName: "Test Madrasa",
  footerText: "Footer Text",
};

vi.mock("@mms/fe-core/hooks/useNavigationState", () => ({
  useNavigationState: () => mockNavState,
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => mockBranding,
}));

vi.mock("@/tenant/hooks/useModuleAccess", () => ({
  useModuleAccess: () => ({
    evaluate: () => ({ enabled: true, accessible: true }),
  }),
}));

vi.mock("@/tenant/hooks/useSessionTimeout", () => ({
  useSessionTimeout: () => null,
}));

vi.mock("@/tenant/hooks/useIndustryTerminology", () => ({
  useIndustryTerminology: () => ({
    facultyLabel: "Staff & Team",
    staffSingular: "Staff",
    studentLabel: "Students",
    locationLabel: "Campus",
  }),
}));

vi.mock("@/tenant/hooks/useInitializeUiState", () => ({
  useInitializeUiState: () => undefined,
}));

vi.mock("@mms/fe-core/hooks/useGlobalShortcut", () => ({
  useGlobalShortcut: () => undefined,
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/providers/MotionPreferences", () => ({
  MotionPreferences: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/tenant/components/layout/Sidebar", () => ({
  default: () => <aside data-testid="sidebar">Sidebar</aside>,
}));

vi.mock("@/tenant/components/layout/MobileSidebar", () => ({
  default: () => <div data-testid="mobile-sidebar">MobileSidebar</div>,
}));

vi.mock("@/tenant/components/layout/TopBar", () => ({
  default: () => <header data-testid="top-bar">TopBar</header>,
}));

vi.mock("@/tenant/components/layout/TopBarActions", () => ({
  default: () => <div data-testid="top-bar-actions">TopBarActions</div>,
}));

vi.mock("@mms/fe-core/components/AppFooter", () => ({
  AppFooter: ({ name, text }: { name?: string; text?: string }) => (
    <footer>
      {name} - {text}
    </footer>
  ),
}));

describe("AppLayout", () => {
  it("renders layout shell with mobile header initials when no logoUrl is set", () => {
    mockBranding = {
      logoUrl: "",
      madrasaName: "Test Madrasa",
      footerText: "Footer Text",
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(html).toContain("Test Madrasa");
    expect(html).toContain("Footer Text");
    expect(html).toContain('data-testid="top-bar"');
    expect(html).toContain('data-testid="sidebar"');
  });

  it("renders mobile header image when logoUrl is provided", () => {
    mockBranding = {
      logoUrl: "https://example.com/logo.png",
      madrasaName: "Custom Academy",
      footerText: "All rights reserved",
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(html).toContain("https://example.com/logo.png");
    expect(html).toContain("Custom Academy");
  });
});
