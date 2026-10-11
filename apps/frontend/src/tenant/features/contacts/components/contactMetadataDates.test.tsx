import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderSolarDobMetadata, renderLunarDobMetadata } from "./contactMetadataDates";

describe("contactMetadataDates helpers", () => {
  it("renders solar DOB metadata", () => {
    const html = renderToStaticMarkup(
      <>
        {renderSolarDobMetadata({
          dob: "2000-01-01",
          showDetailedSolarAge: true,
          language: "en",
          emptyNode: "-",
        })}
      </>,
    );

    expect(html).toContain("2000");
  });

  it("renders lunar DOB metadata when enabled", () => {
    const html = renderToStaticMarkup(
      <>
        {renderLunarDobMetadata({
          dob: "2000-01-01",
          showLunarDob: true,
          showDetailedLunarAge: true,
          language: "en",
          emptyNode: "-",
        })}
      </>,
    );

    expect(html).toContain("font-mono");
  });
});
