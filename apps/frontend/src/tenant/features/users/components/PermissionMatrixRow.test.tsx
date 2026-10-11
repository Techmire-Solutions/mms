import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { PermissionMatrixRow } from "./PermissionMatrixRow";

// Mock useTranslation
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    locale: "en",
    dir: "ltr",
  }),
}));

describe("PermissionMatrixRow", () => {
  const defaultProps = {
    mod: { id: "students", labelKey: "nav.students" as const },
    perms: {
      students: ["read", "update"] as ("read" | "update")[],
    },
    readOnly: false,
    inGroup: false,
    onToggle: vi.fn(),
    onSelectAll: vi.fn(),
    onClearAll: vi.fn(),
  };

  it("renders module title and count badge", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <PermissionMatrixRow {...defaultProps} />
        </tbody>
      </table>,
    );
    expect(html).toContain("nav.students");
    expect(html).toContain("2/4");
  });

  it("renders indented cell when inGroup is true", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <PermissionMatrixRow {...defaultProps} inGroup={true} />
        </tbody>
      </table>,
    );
    expect(html).toContain("ps-8");
  });

  it("renders accessible status indicators in read-only mode", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <PermissionMatrixRow {...defaultProps} readOnly={true} />
        </tbody>
      </table>,
    );
    expect(html).toContain('role="status"');
  });
});
