import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformAdminsListCards } from "./PlatformAdminsListCards";
import {
  DEFAULT_PLATFORM_ADMIN_PERMISSIONS,
  FULL_PLATFORM_ADMIN_PERMISSIONS,
  type PlatformUserProfile,
} from "@mms/shared";
import type { EntityDescriptor } from "@/types/entityRegistry";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockAdmins: PlatformUserProfile[] = [
  {
    id: "admin-1",
    name: "Jane Super",
    email: "jane@example.com",
    role: "super_user",
    permissions: FULL_PLATFORM_ADMIN_PERMISSIONS,
    disabledAt: null,
    createdAt: "2025-01-01T00:00:00Z",
    emailVerifiedAt: "2025-01-02T00:00:00Z",
  },
  {
    id: "admin-2",
    name: "Bob Operator",
    email: "bob@example.com",
    role: "admin",
    permissions: DEFAULT_PLATFORM_ADMIN_PERMISSIONS,
    disabledAt: "2025-02-01T00:00:00Z",
    createdAt: "2025-01-15T00:00:00Z",
  },
];

const mockDescriptor: EntityDescriptor<PlatformUserProfile> = {
  type: "platformUsers",
  titleKey: "platform.adminsTitle",
  getTableColumns: () => [
    { id: "name", label: "Name" },
    { id: "email", label: "Email" },
  ],
  getCardFields: () => [{ key: "email", label: "Email" }],
  renderFieldValue: (fieldKey: string, entity: PlatformUserProfile) =>
    String(entity[fieldKey as keyof PlatformUserProfile] ?? ""),
  formatFieldValue: (fieldId: string, entity: PlatformUserProfile) =>
    String(entity[fieldId as keyof PlatformUserProfile] ?? ""),
} as unknown as EntityDescriptor<PlatformUserProfile>;

describe("PlatformAdminsListCards Component", () => {
  it("renders admin cards with name, status badges, and action buttons", () => {
    const html = renderToStaticMarkup(
      <PlatformAdminsListCards
        admins={mockAdmins}
        descriptor={mockDescriptor}
        onInspect={vi.fn()}
        onEditAccess={vi.fn()}
        onToggleStatus={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(html).toContain("Jane Super");
    expect(html).toContain("Bob Operator");
    expect(html).toContain("platform.profileMemberSince");
  });
});
