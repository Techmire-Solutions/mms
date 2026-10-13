import { describe, expect, it } from "vitest";
import {
  DETAIL_SECTION_TITLE,
  FORM_CARD,
  FORM_CHECKBOX,
  FORM_ERROR,
  FORM_ERROR_BOX,
  FORM_INPUT,
  FORM_INPUT_BUILDER,
  FORM_INPUT_COMPACT,
  FORM_INPUT_ICON,
  FORM_LABEL,
  FORM_OTP_DIGIT,
  FORM_SELECT,
  FORM_SELECT_MINI,
  FORM_TEXTAREA,
  WORK_STICKY_HEAD,
  WORK_SURFACE,
  WORK_SURFACE_INNER,
  WORK_TOOLBAR_TRIGGER,
  WORK_TOOLBAR_TRIGGER_ACTIVE,
  WORK_TOOLBAR_TRIGGER_FILTER_ACTIVE,
  WORK_TOOLBAR_TRIGGER_FILTER_IDLE,
  WORK_TOOLBAR_TRIGGER_IDLE,
} from "../ui/formStyles";

describe("formStyles Design Token Contract", () => {
  const interactiveInputs = [
    FORM_INPUT,
    FORM_SELECT,
    FORM_TEXTAREA,
    FORM_INPUT_ICON,
    FORM_INPUT_COMPACT,
    FORM_INPUT_BUILDER,
    FORM_OTP_DIGIT,
    FORM_SELECT_MINI,
    WORK_TOOLBAR_TRIGGER,
  ];

  it("enforces 44px min-height touch targets and touch-manipulation on interactive input tokens", () => {
    interactiveInputs.forEach((token) => {
      expect(token).toContain("min-h-11");
      expect(token).toContain("touch-manipulation");
    });
  });

  it("enforces focus-visible ring styles on all focusable inputs and triggers", () => {
    const focusableTokens = [
      FORM_INPUT,
      FORM_SELECT,
      FORM_TEXTAREA,
      FORM_INPUT_ICON,
      FORM_INPUT_COMPACT,
      FORM_INPUT_BUILDER,
      FORM_OTP_DIGIT,
      FORM_CHECKBOX,
      FORM_SELECT_MINI,
      WORK_TOOLBAR_TRIGGER,
    ];

    focusableTokens.forEach((token) => {
      expect(token).toContain("focus-visible:");
    });
  });

  it("enforces 44px touch target on FORM_CHECKBOX via pseudo-element", () => {
    expect(FORM_CHECKBOX).toContain("after:h-11");
    expect(FORM_CHECKBOX).toContain("after:w-11");
  });

  it("enforces BiDi logical properties instead of physical left/right rules", () => {
    const directionalTokens = [FORM_INPUT_ICON, FORM_CHECKBOX];

    directionalTokens.forEach((token) => {
      expect(token).not.toMatch(/\bpl-\d+/);
      expect(token).not.toMatch(/\bpr-\d+/);
    });

    expect(FORM_INPUT_ICON).toContain("ps-9");
    expect(FORM_INPUT_ICON).toContain("pe-3");
    expect(FORM_CHECKBOX).toContain("after:start-1/2");
  });

  it("defines valid error tokens referencing destructive color tokens", () => {
    expect(FORM_ERROR).toContain("text-destructive");
    expect(FORM_ERROR_BOX).toContain("border-destructive");
    expect(FORM_ERROR_BOX).toContain("bg-destructive");
  });

  it("defines valid calm surface elevation and toolbar tokens with radius hierarchy", () => {
    expect(WORK_SURFACE).toContain("border-foreground/10");
    expect(WORK_SURFACE).toContain("rounded-2xl");
    expect(WORK_SURFACE_INNER).toContain("border-foreground/8");
    expect(WORK_SURFACE_INNER).toContain("rounded-xl");
    expect(WORK_STICKY_HEAD).toContain("bg-card");
    expect(FORM_CARD).toContain("border-foreground/10");
    expect(FORM_CARD).toContain("rounded-2xl");

    expect(WORK_TOOLBAR_TRIGGER).toContain("rounded-xl");
    expect(WORK_TOOLBAR_TRIGGER_ACTIVE).toContain("border-primary");
    expect(WORK_TOOLBAR_TRIGGER_IDLE).toContain("border-border");
    expect(WORK_TOOLBAR_TRIGGER_FILTER_ACTIVE).toContain("bg-primary/5");
    expect(WORK_TOOLBAR_TRIGGER_FILTER_IDLE).toContain("text-foreground");
    expect(FORM_LABEL).toContain("uppercase");
    expect(DETAIL_SECTION_TITLE).toContain("uppercase");
  });
});
