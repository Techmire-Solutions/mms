import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { PermissionMatrix } from "./PermissionMatrix";
import { RBAC_MODULE_REGISTRY } from "@mms/shared";

// Mock useTranslation
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    locale: "en",
    dir: "ltr",
  }),
}));

describe("PermissionMatrix", () => {
  const defaultProps = {
    modules: RBAC_MODULE_REGISTRY,
    perms: {
      students: ["read", "create"] as ("read" | "create")[],
      finance: ["read"] as "read"[],
    },
    readOnly: false,
    onToggle: vi.fn(),
    onSelectAll: vi.fn(),
    onClearAll: vi.fn(),
  };

  it("renders all module groups and header cells", () => {
    const html = renderToStaticMarkup(<PermissionMatrix {...defaultProps} />);
    expect(html).toContain("users.permissions.colModule");
    expect(html).toContain("users.permission.read");
    expect(html).toContain("users.permission.create");
    expect(html).toContain("users.permission.update");
    expect(html).toContain("users.permission.delete");
    expect(html).toContain("common.columns.searchPlaceholder");
  });

  it("renders empty state when no modules provided", () => {
    const html = renderToStaticMarkup(<PermissionMatrix {...defaultProps} modules={[]} />);
    expect(html).toContain("users.permissions.emptyRoles");
  });

  it("renders cards mode without table element", () => {
    const html = renderToStaticMarkup(<PermissionMatrix {...defaultProps} viewMode="cards" />);
    expect(html).not.toContain("<table");
    expect(html).toContain("students");
  });

  it("renders table mode with table element", () => {
    const html = renderToStaticMarkup(<PermissionMatrix {...defaultProps} viewMode="table" />);
    expect(html).toContain("<table");
    expect(html).toContain("users.permissions.colModule");
  });
});
