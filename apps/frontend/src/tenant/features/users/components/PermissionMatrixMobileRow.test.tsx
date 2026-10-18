import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { PermissionMatrixMobileRow } from "./PermissionMatrixMobileRow";

// Mock useTranslation
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    locale: "en",
    dir: "ltr",
  }),
}));

describe("PermissionMatrixMobileRow", () => {
  const defaultProps = {
    mod: { id: "students", labelKey: "nav.students" as const },
    perms: {
      students: ["read", "create"] as ("read" | "create")[],
    },
    readOnly: false,
    onToggle: vi.fn(),
    onSelectAll: vi.fn(),
    onClearAll: vi.fn(),
  };

  it("renders module title, actions, and count pill", () => {
    const html = renderToStaticMarkup(<PermissionMatrixMobileRow {...defaultProps} />);
    expect(html).toContain("nav.students");
    expect(html).toContain("2/4");
    expect(html).toContain("users.permission.read");
    expect(html).toContain("users.permission.create");
    expect(html).toContain("users.permission.update");
    expect(html).toContain("users.permission.delete");
    expect(html).toContain("users.permissions.colAll");
  });

  it("renders read-only mode without select all button", () => {
    const html = renderToStaticMarkup(
      <PermissionMatrixMobileRow {...defaultProps} readOnly={true} />,
    );
    expect(html).toContain("nav.students");
    expect(html).not.toContain("users.permissions.colAll");
  });
});
