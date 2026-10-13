import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentsSetupTier } from "./StudentsSetupTier";

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({ canEditSetup: true }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/ModuleTierMotion", () => ({
  ModuleTierMotion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("StudentsSetupTier Component", () => {
  it("renders setup tier container with Preferences and Card Template subtabs", () => {
    const html = renderToStaticMarkup(<StudentsSetupTier />);
    expect(html).toBeDefined();
    expect(html).toContain("students.setup.preferences");
    expect(html).toContain("students.setup.cardTemplate");
  });
});
