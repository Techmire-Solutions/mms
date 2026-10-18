import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformAddAdminForm } from "./PlatformAddAdminForm";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "platform.addAdmin": "Add Operator",
        "platform.addAdminSubtitle": "Provision a new platform operator",
        "platform.addAdminCardDesc": "Platform operators have apex system access",
        "platform.adminName": "Full Name",
        "platform.adminEmail": "Email Address",
        "platform.adminPassword": "Password",
        "common.cancel": "Cancel",
      };
      return map[key] ?? key;
    },
    dir: "ltr",
    language: "en",
  }),
}));

vi.mock("@/platform/hooks/usePlatformAdmins", () => ({
  useAddPlatformAdmin: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="form-modal">
        <h2>{title}</h2>
        <div>{children}</div>
      </div>
    ) : null,
}));

describe("PlatformAddAdminForm", () => {
  it("renders Button trigger when asTriggerOnly is true", () => {
    const html = renderToStaticMarkup(<PlatformAddAdminForm asTriggerOnly />);

    expect(html).toContain("Add Operator");
    expect(html).toContain("<button");
  });

  it("renders within SectionCard when asTriggerOnly is false", () => {
    const html = renderToStaticMarkup(<PlatformAddAdminForm asTriggerOnly={false} />);

    expect(html).toContain("Add Operator");
    expect(html).toContain("Provision a new platform operator");
    expect(html).toContain("Platform operators have apex system access");
  });
});
