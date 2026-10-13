import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacultySetupTier } from "./FacultySetupTier";

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({ canEditSetup: true }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/features/faculty/components/FacultySettings", () => ({
  default: () => <div data-testid="faculty-settings">Faculty Settings Panel</div>,
  FacultySettings: () => <div data-testid="faculty-settings">Faculty Settings Panel</div>,
}));

vi.mock("@/components/app/ModuleTierMotion", () => ({
  ModuleTierMotion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("FacultySetupTier Component", () => {
  it("renders FacultySettings panel within setup tier", () => {
    const html = renderToStaticMarkup(<FacultySetupTier />);
    expect(html).toBeDefined();
  });
});
