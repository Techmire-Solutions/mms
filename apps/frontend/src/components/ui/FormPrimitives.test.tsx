import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./input";
import {
  CardTypeLabel,
  CardRemoveButton,
  Field,
  FormCardTypeSelect,
  FormCheckboxCard,
  INPUT,
  SELECT,
  TEXTAREA,
  LABEL,
  COLLECTION_CARD,
  COLLECTION_BODY,
  TYPE_SELECT_WIDTH,
} from "./FormPrimitives";

describe("FormPrimitives", () => {
  describe("CardTypeLabel", () => {
    it("creates a element with uppercase styling classes", () => {
      const element = CardTypeLabel({ children: "Contact Type" });
      expect(element.type).toBe("span");
      expect(element.props.children).toBe("Contact Type");
      expect(element.props.className).toContain("uppercase");
    });
  });

  describe("FormCardTypeSelect", () => {
    it("wraps CardTypeLabel and the discriminative control", () => {
      const html = renderToStaticMarkup(
        <FormCardTypeSelect label="Relationship Type">
          <span>Parent</span>
        </FormCardTypeSelect>,
      );
      expect(html).toContain("Relationship Type");
      expect(html).toContain("Parent");
      expect(html).toContain("uppercase");
    });
  });

  describe("CardRemoveButton", () => {
    it("renders a remove button with correct aria-label and click handler", () => {
      const onClick = vi.fn();
      const element = CardRemoveButton({ onClick, label: "Remove item" });
      expect(element.props["aria-label"]).toBe("Remove item");
      expect(element.props.onClick).toBe(onClick);
    });
  });

  describe("Field", () => {
    it("associates its label with an explicitly identified nested control", () => {
      const markup = renderToStaticMarkup(
        <Field label="Amount" required>
          <div>
            <Input id="payment-amount" name="amount" />
          </div>
        </Field>,
      );

      expect(markup).toContain('for="payment-amount"');
      expect(markup).toContain('id="payment-amount"');
      expect(markup).toContain('name="amount"');
    });
  });

  describe("FormCheckboxCard", () => {
    it("renders with label and htmlFor linked to id", () => {
      const markup = renderToStaticMarkup(
        <FormCheckboxCard
          id="test-checkbox"
          name="testCheckbox"
          checked={true}
          onCheckedChange={() => {}}
          label="Test Option"
          description="Test description"
        />,
      );

      expect(markup).toContain('for="test-checkbox"');
      expect(markup).toContain('id="test-checkbox"');
      expect(markup).toContain('name="testCheckbox"');
      expect(markup).toContain("Test Option");
      expect(markup).toContain("Test description");
      expect(markup).toContain("bg-primary/10");
    });

    it("renders error message when error is provided", () => {
      const markup = renderToStaticMarkup(
        <FormCheckboxCard
          id="error-checkbox"
          checked={false}
          onCheckedChange={() => {}}
          label="Error Option"
          error="This is a required field"
        />,
      );

      expect(markup).toContain("This is a required field");
      expect(markup).toContain("text-destructive");
    });
  });

  describe("Design System Constants", () => {
    it("exports non-empty CSS utility strings", () => {
      expect(typeof INPUT).toBe("string");
      expect(INPUT.length).toBeGreaterThan(0);
      expect(typeof SELECT).toBe("string");
      expect(SELECT.length).toBeGreaterThan(0);
      expect(typeof TEXTAREA).toBe("string");
      expect(TEXTAREA.length).toBeGreaterThan(0);
      expect(typeof LABEL).toBe("string");
      expect(LABEL.length).toBeGreaterThan(0);
      expect(COLLECTION_CARD).toContain("rounded-xl");
      expect(COLLECTION_BODY).toBe("space-y-3");
      expect(TYPE_SELECT_WIDTH).toBe("w-32");
    });
  });
});
