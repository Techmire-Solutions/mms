import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformModuleSelectCard } from "./PlatformModuleSelectCard";
import type { ModuleDefinition } from "@mms/shared";
import { BookOpen } from "lucide-react";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockModule: ModuleDefinition = {
  id: "students",
  label: "Students",
  description: "Manage student enrollment and records",
  icon: "BookOpen",
  required: false,
  category: "core",
};

const mockRequiredModule: ModuleDefinition = {
  id: "dashboard",
  label: "Dashboard",
  description: "Platform overview and metrics",
  icon: "LayoutDashboard",
  required: true,
  category: "core",
};

describe("PlatformModuleSelectCard Component", () => {
  it("renders module label and description", () => {
    const html = renderToStaticMarkup(
      <PlatformModuleSelectCard
        module={mockModule}
        selected={true}
        icon={BookOpen}
        onToggle={vi.fn()}
      />,
    );

    expect(html).toContain("Students");
    expect(html).toContain("Manage student enrollment and records");
    expect(html).toContain("border-primary/40");
  });

  it("renders required tag when module is required", () => {
    const html = renderToStaticMarkup(
      <PlatformModuleSelectCard module={mockRequiredModule} selected={true} onToggle={vi.fn()} />,
    );

    expect(html).toContain("Dashboard");
    expect(html).toContain("platform.moduleRequired");
  });
});
