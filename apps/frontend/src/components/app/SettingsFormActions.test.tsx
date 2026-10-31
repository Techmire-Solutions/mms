import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsFormActions } from "./SettingsFormActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, dir: "ltr" }),
}));

describe("SettingsFormActions", () => {
  it("pins the save bar when requested by a long settings panel", () => {
    const html = renderToStaticMarkup(
      <SettingsFormActions saveLabel="Save" onSave={vi.fn()} dirty sticky />,
    );

    expect(html).toContain("sticky bottom-0");
  });

  it("stays in flow for short panels", () => {
    const html = renderToStaticMarkup(<SettingsFormActions saveLabel="Save" onSave={vi.fn()} />);

    expect(html).not.toContain("sticky bottom-0");
  });
});
