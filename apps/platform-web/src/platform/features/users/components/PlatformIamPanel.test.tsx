import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { captured } = vi.hoisted(() => ({
  captured: {
    table: undefined as Record<string, unknown> | undefined,
    modal: undefined as Record<string, unknown> | undefined,
  },
}));

const { permissions } = vi.hoisted(() => ({ permissions: { isSuperUser: true } }));

vi.mock("@mms/mod-iam/frontend/platform", () => ({
  GlobalUsersTable: (props: Record<string, unknown>) => {
    captured.table = props;
    return <div data-testid="global-users">Global Users</div>;
  },
  TenantImpersonationModal: (props: Record<string, unknown>) => {
    captured.modal = props;
    return <div data-testid="impersonation-modal" />;
  },
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/platform/hooks/usePlatformPermissions", () => ({
  usePlatformPermissions: () => permissions,
}));

import { PlatformIamPanel } from "@/platform/features/users/components/PlatformIamPanel";

describe("PlatformIamPanel", () => {
  it("offers impersonation only to super users", () => {
    permissions.isSuperUser = true;
    const html = renderToStaticMarkup(<PlatformIamPanel />);

    expect(html).toContain("Global Users");
    expect(typeof captured.table?.onImpersonate).toBe("function");
    expect(captured.table?.labels).toMatchObject({
      title: "platform.iam.title",
      impersonate: "platform.iam.impersonate",
    });
    expect(captured.modal?.open).toBe(false);
  });

  it("hides the impersonation action for delegated platform admins", () => {
    permissions.isSuperUser = false;
    renderToStaticMarkup(<PlatformIamPanel />);

    expect(captured.table?.onImpersonate).toBeUndefined();
    expect(captured.modal?.labels).toMatchObject({ done: "platform.iam.done" });
  });
});
