import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DrawerUpdatedStamp } from "./DrawerUpdatedStamp";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: "en",
    dir: "ltr",
  }),
}));

describe("DrawerUpdatedStamp", () => {
  it("renders null when both updatedAt and createdAt are missing", () => {
    const html = renderToStaticMarkup(<DrawerUpdatedStamp label="Updated" />);
    expect(html).toBe("");
  });

  it("renders formatted date with relative time when stamp is provided", () => {
    const recentDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const html = renderToStaticMarkup(<DrawerUpdatedStamp label="Updated" updatedAt={recentDate} />);

    expect(html).toContain("Updated");
    expect(html).toContain("ago");
  });

  it("can omit relative time when showRelative is false", () => {
    const recentDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const html = renderToStaticMarkup(
      <DrawerUpdatedStamp label="Updated" updatedAt={recentDate} showRelative={false} />,
    );

    expect(html).toContain("Updated");
    expect(html).not.toContain("ago");
  });
});
