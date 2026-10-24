import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DetailSectionTitle } from "./DetailSectionTitle";

describe("DetailSectionTitle", () => {
  it("renders children without a count pill when count is omitted", () => {
    const html = renderToStaticMarkup(<DetailSectionTitle>Appointments</DetailSectionTitle>);
    expect(html).toContain("Appointments");
    expect(html).not.toContain("rounded-full");
  });

  it("renders a count pill when count is provided", () => {
    const html = renderToStaticMarkup(
      <DetailSectionTitle count={3}>Appointments</DetailSectionTitle>,
    );
    expect(html).toContain("Appointments");
    expect(html).toContain(">3<");
    expect(html).toContain("rounded-full");
  });
});
