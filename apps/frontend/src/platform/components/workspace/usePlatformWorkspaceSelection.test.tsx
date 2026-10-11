import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";
import { usePlatformWorkspaceSelection } from "./usePlatformWorkspaceSelection";

const mockWorkspaces: PlatformWorkspaceRowData[] = [
  {
    subdomain: "madrasa1",
    madrasaName: "Madrasa One",
    enabled: true,
    requireEmailVerification: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

function TestSelectionComponent() {
  const selection = usePlatformWorkspaceSelection(mockWorkspaces);
  return <div data-count={selection.selectedCount}>Count: {selection.selectedCount}</div>;
}

describe("usePlatformWorkspaceSelection", () => {
  it("initializes with zero selected items", () => {
    const html = renderToStaticMarkup(<TestSelectionComponent />);
    expect(html).toContain("Count: 0");
  });
});
