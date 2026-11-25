import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAddAdminForm } from "@/platform/features/users/components/PlatformAddAdminForm";

vi.mock("@mms/fe-core/i18n", () => ({
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

vi.mock("@/platform/features/users/hooks/usePlatformAdmins", () => ({
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
  // The form mounts a portal, which the server renderer cannot handle — render it into a DOM
  // and assert on what the document actually shows (the same pattern calendarLocalization uses).
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderHtml(node: React.ReactElement): Promise<string> {
    await act(async () => {
      root.render(node);
    });
    return document.body.innerHTML;
  }

  it("renders Button trigger when asTriggerOnly is true", async () => {
    const html = await renderHtml(<PlatformAddAdminForm asTriggerOnly />);

    expect(html).toContain("Add Operator");
    expect(html).toContain("<button");
  });

  it("renders within SectionCard when asTriggerOnly is false", async () => {
    const html = await renderHtml(<PlatformAddAdminForm asTriggerOnly={false} />);

    expect(html).toContain("Add Operator");
    expect(html).toContain("Provision a new platform operator");
    expect(html).toContain("Platform operators have apex system access");
  });
});
