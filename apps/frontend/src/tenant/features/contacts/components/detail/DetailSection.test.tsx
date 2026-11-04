import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FieldGroupCard } from "./DetailSection";

describe("FieldGroupCard", () => {
  it("renders FieldGroupCard with valid fields", () => {
    const html = renderToStaticMarkup(
      <FieldGroupCard
        group="Identity"
        fields={[{ key: "gender", label: "Gender", type: "text" }]}
        formatValue={() => "Male"}
        getRawValue={() => "male"}
      />,
    );

    expect(html).toContain("Identity");
    expect(html).toContain("Gender");
    expect(html).toContain("Male");
  });

  it("returns null when no fields have values", () => {
    const html = renderToStaticMarkup(
      <FieldGroupCard
        group="Empty"
        fields={[{ key: "x", label: "X", type: "text" }]}
        formatValue={() => null}
      />,
    );
    expect(html).toBe("");
  });
});
