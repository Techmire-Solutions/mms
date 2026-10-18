import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  FacultyUserAccountSection,
  type FacultyUserAccountDraft,
} from "./FacultyUserAccountSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/useWorkspaceRoles", () => ({
  useWorkspaceRoles: () => [
    {
      id: "admin",
      labelKey: "users.role.admin",
      descriptionKey: "users.desc.admin",
      isSystem: true,
      badgeVariant: "primary",
      permissions: {},
    },
    {
      id: "staff",
      labelKey: "users.role.staff",
      descriptionKey: "users.desc.staff",
      isSystem: true,
      badgeVariant: "muted",
      permissions: {},
    },
    {
      id: "custom_role",
      labelKey: "custom_role",
      descriptionKey: "custom_role_desc",
      customLabel: "Senior Mudarris",
      isSystem: false,
      badgeVariant: "success",
      permissions: {},
    },
  ],
}));

vi.mock("@/tenant/hooks/collections/users", () => ({
  useUsersContractList: () => ({
    data: {
      users: [{ id: "usr-1", contactId: "cnt-1", email: "faculty@madrasa.org", role: "staff" }],
    },
  }),
}));

describe("FacultyUserAccountSection Component", () => {
  const queryClient = new QueryClient();

  const wrapWithQueryClient = (node: React.ReactNode) => (
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
  );

  it("renders linked user account info and role selector when contact has an existing user", () => {
    const draft: FacultyUserAccountDraft = {
      enabled: false,
      role: "staff",
      setupMethod: "password",
    };

    const html = renderToStaticMarkup(
      wrapWithQueryClient(
        <FacultyUserAccountSection
          facultyDraft={{ contactId: "cnt-1" }}
          linkedContact={
            { id: "cnt-1", name: "Ustadh Umar", email: "faculty@madrasa.org" } as unknown as never
          }
          userAccountDraft={draft}
          onUserAccountDraftChange={vi.fn()}
          errors={{}}
        />,
      ),
    );

    expect(html).toContain("faculty.form.linkedUserAccount");
    expect(html).toContain("faculty@madrasa.org");
    expect(html).toContain("users.fieldRole");
  });

  it("renders grant login access toggle and provisioning options when no user is linked", () => {
    const draft: FacultyUserAccountDraft = {
      enabled: true,
      role: "staff",
      setupMethod: "password",
      password: "secretpassword123",
      forceReset: true,
    };

    const html = renderToStaticMarkup(
      wrapWithQueryClient(
        <FacultyUserAccountSection
          facultyDraft={{ contactId: "cnt-2" }}
          linkedContact={
            { id: "cnt-2", name: "Ustadh Zayd", email: "zayd@madrasa.org" } as unknown as never
          }
          userAccountDraft={draft}
          onUserAccountDraftChange={vi.fn()}
          errors={{}}
        />,
      ),
    );

    expect(html).toContain("faculty.form.sectionUserAccount");
    expect(html).toContain("faculty.form.grantLoginAccess");
    expect(html).toContain("users.addAccountMethod");
    expect(html).toContain("auth.password");
  });
});
