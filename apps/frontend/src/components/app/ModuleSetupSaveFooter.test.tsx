import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModuleSetupSaveFooter } from "./ModuleSetupSaveFooter";

describe("ModuleSetupSaveFooter", () => {
  it("renders disabled save button when not dirty", () => {
    const html = renderToStaticMarkup(
      <ModuleSetupSaveFooter
        dirty={false}
        saving={false}
        saved={false}
        saveLabel="Save Changes"
        savedLabel="Saved!"
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("Save Changes");
    expect(html).toContain('disabled=""');
  });

  it("renders active save button and warning when dirty", () => {
    const html = renderToStaticMarkup(
      <ModuleSetupSaveFooter
        dirty={true}
        saving={false}
        saved={false}
        unsavedWarning="You have unsaved changes"
        saveLabel="Save Changes"
        savedLabel="Saved!"
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("Save Changes");
    expect(html).toContain("You have unsaved changes");
    expect(html).not.toContain('disabled=""');
  });

  it("renders saved label and success styling when saved", () => {
    const html = renderToStaticMarkup(
      <ModuleSetupSaveFooter
        dirty={false}
        saving={false}
        saved={true}
        saveLabel="Save Changes"
        savedLabel="Saved!"
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("Saved!");
    expect(html).toContain("bg-success");
  });

  it("supports disableUnsavedGuard for section-level footers", () => {
    const html = renderToStaticMarkup(
      <ModuleSetupSaveFooter
        dirty={true}
        saving={false}
        saved={false}
        saveLabel="Save Section"
        savedLabel="Saved!"
        disableUnsavedGuard
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("Save Section");
  });
});
