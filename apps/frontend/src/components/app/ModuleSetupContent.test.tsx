import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModuleSetupContent } from "./ModuleSetupContent";

describe("ModuleSetupContent", () => {
  it("given desktop setup content, should render full-width without a max-width rail", () => {
    const html = renderToStaticMarkup(
      <ModuleSetupContent>
        <p>prefs</p>
      </ModuleSetupContent>,
    );
    expect(html).toContain("w-full");
    expect(html).toContain("max-w-none");
    expect(html).not.toContain("max-w-3xl");
    expect(html).not.toContain("max-w-2xl");
    expect(html).toContain("prefs");
  });
});
