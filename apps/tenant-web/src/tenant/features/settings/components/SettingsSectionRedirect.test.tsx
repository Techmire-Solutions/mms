import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import SettingsSectionRedirect from "./SettingsSectionRedirect";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <span>{`${location.pathname}${location.search}`}</span>;
}

describe("SettingsSectionRedirect", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function redirectFrom(initialPath: string): Promise<string> {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/settings/:section" element={<SettingsSectionRedirect />} />
            <Route path="/settings" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    return container.textContent ?? "";
  }

  it("given a valid section bookmark, should resolve to the query deep link when visited", async () => {
    // Act
    const location = await redirectFrom("/settings/branding");

    // Assert
    expect(location).toBe("/settings?tab=branding");
  });

  it("given an unknown section, should fall back to plain settings when visited", async () => {
    // Act
    const location = await redirectFrom("/settings/sms");

    // Assert
    expect(location).toBe("/settings");
  });
});
