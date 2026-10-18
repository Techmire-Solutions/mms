import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FormFooterEntityChip, FormFooterErrorChip } from "./FormFooterChip";

describe("FormFooterChip Components", () => {
  describe("FormFooterEntityChip", () => {
    it("renders entity name with custom class and title", () => {
      const html = renderToStaticMarkup(
        <FormFooterEntityChip className="extra-class" title="Ali Raza">
          Ali Raza
        </FormFooterEntityChip>,
      );

      expect(html).toContain("Ali Raza");
      expect(html).toContain("extra-class");
      expect(html).toContain('title="Ali Raza"');
    });
  });

  describe("FormFooterErrorChip", () => {
    it("renders destructive error chip with role status and title", () => {
      const html = renderToStaticMarkup(
        <FormFooterErrorChip title="First name is required">
          First name required
        </FormFooterErrorChip>,
      );

      expect(html).toContain("First name required");
      expect(html).toContain('role="status"');
      expect(html).toContain('title="First name is required"');
      expect(html).toContain("bg-destructive/10");
      expect(html).toContain("text-destructive");
    });
  });
});
